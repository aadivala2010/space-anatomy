// Launch effects for the rocket figures: one WebGL layer, ray-marched in the figure's own iso camera.
// Everything lives in the rocket's frame (world units, z up, the pad moves down by `rise`).
//   sources   : engine plumes (hydrolox, solid, kerolox, methalox), clusters drawn per nozzle near the exit
//   occluders : vertical frusta (bodies, bells) that hide what is behind them, take plume light and can glow hot
//   deck      : a box with up to 4 openings; flames go down the openings, light pools on the top
//   smoke     : the exhaust trail left behind the climbing rocket and the ground cloud / deluge steam at the pad
//   misc      : ignition flash, igniter sparks, Max-Q vapour cone
// Output is premultiplied: smoke has alpha, flame light is added on top (alpha 0).
export const NS = 16;
export const NO = 24;

export const FX_FRAGMENT = `
#define NS ${NS}
#define NO ${NO}
uniform vec4 uS0[NS]; // exit centre xyz, exit radius
uniform vec4 uS1[NS]; // flow direction xyz, kind (0 hydrolox, 1 solid, 2 kerolox, 3 methalox)
uniform vec4 uS2[NS]; // power, flame length, altitude expansion 0..1, seed
uniform vec4 uS3[NS]; // cluster rings: n0, R0, n1, R1
uniform vec4 uS4[NS]; // n2, R2, single nozzle radius, soot
uniform vec4 uO0[NO]; // axis x, y, z0, z1   (z1 <= z0 disables)
uniform vec4 uO1[NO]; // r0 (at z0), r1 (at z1), heat 0..1, -
uniform vec4 uDeck;   // x0, y0, x1, y1
uniform vec4 uDeckZ;  // top, bottom, enabled, -
uniform vec4 uHole[4];
uniform vec4 uTrail;  // accel (rise = a t^2), mission t, smoke start t, smoke end t
uniform vec4 uTrailC; // cx, cy, half separation along x, base radius
uniform vec4 uTrailK; // strength, exit z (rocket frame), growth, thinning with altitude 0..1
uniform vec4 uTrailS; // smoke starts this far below the exits
uniform vec4 uGround; // seconds since ignition, smoke strength, steam strength, base z
uniform vec4 uGround2;// cx, cy, max radius, -
uniform vec4 uMisc;   // rise, vapour, flash, sparks
uniform vec4 uVap;    // vapour cone: z top, z bottom, radius, -
uniform vec4 uSpark;  // sparks centre x, y, z, radius
uniform vec4 uWind;   // wind x, y, sun strength, quality
uniform vec3 uSky;
uniform float uClock; // real seconds (turbulence), frozen while paused
uniform float uGreen; // TEA-TEB ignition flash on kerolox engines (0..1)

const float TAU=6.2831853;
vec3 Vd;
// smoother value noise (quintic fade) and a rotated fbm: no grid-aligned blocks in the smoke
float vn(vec3 p){vec3 i=floor(p);vec3 f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
  float a=mix(mix(hash13(i),hash13(i+vec3(1.,0.,0.)),f.x),mix(hash13(i+vec3(0.,1.,0.)),hash13(i+vec3(1.,1.,0.)),f.x),f.y);
  float b=mix(mix(hash13(i+vec3(0.,0.,1.)),hash13(i+vec3(1.,0.,1.)),f.x),mix(hash13(i+vec3(0.,1.,1.)),hash13(i+vec3(1.,1.,1.)),f.x),f.y);
  return mix(a,b,f.z);}
const mat3 ROT=mat3(.00,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
float fbmS(vec3 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=ROT*p*2.03+vec3(3.1,1.7,5.3);a*=.5;}return s/.9375;}

void kindCols(float k,out vec3 core,out vec3 body,out vec3 dia,out float gain){
  if(k<.5){core=vec3(.9,.86,1.);body=vec3(.62,.5,1.);dia=vec3(1.,.78,.62);gain=.5;}
  else if(k<1.5){core=vec3(1.,.96,.88);body=vec3(1.,.6,.24);dia=vec3(1.,.92,.75);gain=2.6;}
  else if(k<2.5){core=mix(vec3(1.,.82,.5),vec3(.55,1.,.6),uGreen);body=mix(vec3(1.,.4,.09),vec3(.2,1.,.35),uGreen);dia=vec3(1.,.95,.8);gain=1.35;}
  else if(k<3.5){core=vec3(1.,.86,.8);body=vec3(1.,.46,.18);dia=vec3(.8,.62,1.);gain=1.45;}
  else {core=vec3(.95,.97,1.);body=vec3(.8,.86,.95);dia=vec3(0.);gain=.45;}
}
vec3 blackbody(float h){ // 0..1 heat to emitted colour, dull red to yellow-white
  return vec3(smoothstep(.0,.45,h),smoothstep(.25,.85,h)*.82,smoothstep(.6,1.,h)*.6)*h*h*2.2;
}
// --- vertical frustum hit: largest t (nearest the viewer); edge softness in e
float hitFrustum(vec3 p0,vec4 a,vec4 b,out vec3 n,out float e,out float zr){
  float best=-1e6; e=0.; zr=0.;
  float h=a.w-a.z; if(h<=0.)return best;
  float k=(b.y-b.x)/h;
  vec2 w=p0.xy-a.xy;
  float A0=b.x+k*(p0.z-a.z), B0=k*Vd.z;
  float qa=dot(Vd.xy,Vd.xy)-B0*B0, qb=2.*(dot(w,Vd.xy)-A0*B0), qc=dot(w,w)-A0*A0;
  float disc=qb*qb-4.*qa*qc;
  if(disc>0.){
    float sq=sqrt(disc);
    float t=qa>0.?(-qb+sq)/(2.*qa):(-qb-sq)/(2.*qa);
    float z=p0.z+t*Vd.z, r=A0+B0*t;
    if(z>=a.z&&z<=a.w&&r>0.){
      best=t;
      vec2 rad=normalize(w+t*Vd.xy);
      n=normalize(vec3(rad,-k));
      vec2 vh=normalize(Vd.xy);
      float dmin=abs(w.x*vh.y-w.y*vh.x);
      e=r-dmin; zr=(z-a.z)/h;
    }
  }
  float tc=(a.w-p0.z)/Vd.z; vec2 wc=w+tc*Vd.xy;
  if(dot(wc,wc)<b.y*b.y&&tc>best){best=tc;n=vec3(0,0,1);e=b.y-length(wc);zr=1.;}
  return best;
}
// --- deck: returns t of the visible surface (or far exit of an opening), sets kind: 1 top, 2 side, 3 inside an opening
float hitDeck(vec3 p0,out vec3 n,out float kind,out vec3 hp){
  kind=0.; n=vec3(0,0,1); hp=vec3(0.);
  if(uDeckZ.z<.5)return -1e6;
  float rise=uMisc.x;
  vec3 lo=vec3(uDeck.xy,uDeckZ.y-rise), hi=vec3(uDeck.zw,uDeckZ.x-rise);
  vec3 iv=1./Vd;
  vec3 t1=(lo-p0)*iv,t2=(hi-p0)*iv;
  vec3 mn=min(t1,t2),mx=max(t1,t2);
  float tin=max(max(mn.x,mn.y),mn.z), tout=min(min(mx.x,mx.y),mx.z);
  if(tin>tout)return -1e6;
  hp=p0+tout*Vd;
  if(tout==mx.z){
    kind=1.;
    for(int i=0;i<4;i++){
      vec4 hr=uHole[i]; if(hr.z<=hr.x)continue;
      if(hp.x>hr.x&&hp.x<hr.z&&hp.y>hr.y&&hp.y<hr.w){
        vec3 l2=vec3(hr.xy,lo.z),h2=vec3(hr.zw,hi.z);
        vec3 a1=(l2-p0)*iv,a2=(h2-p0)*iv;
        vec3 m2=min(a1,a2);
        kind=3.; return max(max(m2.x,m2.y),m2.z);
      }
    }
    return tout;
  }
  kind=2.; n=tout==mx.x?vec3(sign(-Vd.x)*-1.,0,0):vec3(0,sign(-Vd.y)*-1.,0);
  return tout;
}
// light a surface point from every burning source
vec3 plumeLight(vec3 x,vec3 n,float wrap){
  vec3 L=vec3(0.);
  for(int i=0;i<NS;i++){
    vec4 a=uS0[i],b=uS1[i],c=uS2[i];
    if(c.x<.002)continue;
    vec3 core,body,dia;float gain;kindCols(b.w,core,body,dia,gain);
    float re=a.w;
    vec3 lp=a.xyz+b.xyz*(re*2.2+c.y*.12);
    vec3 dl=lp-x; float dd=dot(dl,dl);
    float f=dot(n,dl*inversesqrt(dd));
    f=clamp((f+wrap)/(1.+wrap),0.,1.);
    float sz=re*re*(6.+c.y*.05);
    L+=mix(body,core,.35)*gain*c.x*f*sz/(dd+sz*.6);
  }
  return L;
}
// --- smoke fields. oct: 2 = full detail, 1 = coarse (sun shadow probe).
// Each field also lowers gStep: how far the march may advance safely from here (empty-space skipping).
float gStep;
float trailD(vec3 x,float oct){
  if(uTrailK.x<.002)return 0.;
  gStep=min(gStep,22.);
  float h=x.z+uMisc.x-uTrailK.y;
  float tp=sqrt(max(h,0.)/uTrail.x);
  float age=uTrail.y-tp;
  if(age<0.)return 0.;
  float below=uTrailK.y-x.z;
  float live=smoothstep(uTrail.z,uTrail.z+.8,tp)*(1.-smoothstep(uTrail.w-8.,uTrail.w,tp))*smoothstep(uTrailS.x*.25,uTrailS.x*1.1,below);
  live*=smoothstep(-30.,20.,h);
  if(live<.001)return 0.;
  vec2 c=uTrailC.xy+uWind.xy*age;
  vec2 q=x.xy-c;
  float hs=uTrailC.z*exp(-age*.12);
  vec2 qs=vec2(q.x-clamp(q.x,-hs,hs),q.y);
  float R=uTrailC.w*(1.+.9*smoothstep(0.,uTrailS.x*2.5,below))+uTrailK.z*sqrt(age)*15.+age*3.5;
  float rho=length(qs)/R;
  float d=1.1-rho;
  float fine=clamp(R*.11,8.,60.);
  gStep=min(gStep,fine*(d<-.75?1.6:1.));
  if(d<-.75)return 0.;
  gStep=min(gStep,fine);
  vec3 pn=vec3(q/(uTrailC.w*2.8+age*2.5),h/(uTrailC.w*3.2));
  float n=oct>1.5?fbmS(pn+vec3(0.,0.,uClock*.02)):vn(ROT*pn*.55)*.6+.2;
  d+=(n-.5)*1.4;
  float dens=smoothstep(0.,1.1,d)*live;
  dens*=mix(1.,.18,uTrailK.w)/(1.+age*.05);
  return dens*uTrailK.x*1.7;
}
float groundD(vec3 x,float oct){
  float tau=uGround.x,s=uGround.y+uGround.z;
  if(tau<=0.||s<.002)return 0.;
  vec3 c=vec3(uGround2.xy,uGround.w-uMisc.x);
  float R=min(uGround2.z,(40.+110.*sqrt(tau)+8.*tau)*(.45+.55*clamp(s,0.,1.)));
  vec3 q=x-c; q.xy-=uWind.xy*tau*.5;
  float H=R*.36+18.;
  float lq=length(q/vec3(R,R,H));
  float d=1.-lq;
  float fine=clamp(H*.12,8.,50.);
  if(d<-.7||q.z<-H*.4){gStep=min(gStep,max(fine,(lq-1.7)*H));return 0.;}
  gStep=min(gStep,fine);
  vec3 pn=q/(R*.42)+vec3(1.3,2.1,-tau*.03);
  float n=oct>1.5?fbmS(pn):vn(ROT*pn*.55)*.6+.2;
  d+=(n-.5)*1.25;
  return smoothstep(0.,1.,d)*smoothstep(-H*.4,H*.05,q.z)*s*2.6;
}
// vertical cone/cylinder r(z)=r0+k(z-z0): both roots along the ray
vec2 coneRoots(vec3 p0,vec2 c,float z0,float r0,float k){
  vec2 w=p0.xy-c;
  float A0=r0+k*(p0.z-z0),B0=k*Vd.z;
  float qa=dot(Vd.xy,Vd.xy)-B0*B0,qb=2.*(dot(w,Vd.xy)-A0*B0),qc=dot(w,w)-A0*A0;
  float disc=qb*qb-4.*qa*qc;
  if(disc<=0.)return vec2(1e6,-1e6);
  float sq=sqrt(disc);
  float a=(-qb-sq)/(2.*qa),b=(-qb+sq)/(2.*qa);
  return vec2(min(a,b),max(a,b));
}
// Mach diamonds of one nozzle, integrated along the ray at its closest approach to the nozzle axis
float diamondsOf(vec3 p0,vec3 a,vec3 d,float er,float ex,float tOcc,float floorZ){
  vec3 w=p0-a;
  float b=dot(Vd,d),den=max(1.-b*b,.05);
  float tcl=(b*dot(w,d)-dot(w,Vd))/den;
  if(tcl<tOcc)return 0.;
  vec3 xc=p0+tcl*Vd;
  vec3 r=xc-a;
  float s=dot(r,d);
  if(s<0.)return 0.;
  float m=length(r-s*d);
  float lam=er*(1.8+ex*3.);
  float f=fract(s/lam+.5)-.5;
  float dd=abs(f)*lam*.6+m;
  float on=smoothstep(lam*.35,lam*.9,s)*exp(-s/(lam*5.))*(1.-ex*.9)*smoothstep(floorZ-20.,floorZ-3.,xc.z);
  float wd=er*.4;
  return exp(-dd*dd/(wd*wd))*on*wd*1.77/sqrt(den);
}
float ign(vec2 f){return fract(52.9829189*fract(dot(f,vec2(.06711056,.00583715))));}
void main(){
  vec2 vb=viewOf(gl_FragCoord.xy);
  Vd=towardViewer();
  vec3 p0=rayOf(vb);
  float px=pixelOf();
  float dith=hash12(gl_FragCoord.xy*1.031+fract(uClock*7.31)*97.);
  vec3 SUN=lightDir();
  // ---------- opaque hits
  float tOcc=-1e6; vec3 nOcc=vec3(0,0,1); float eOcc=0.,heat=0.,zr=0.;
  for(int i=0;i<NO;i++){
    vec3 n;float e,z;
    float t=hitFrustum(p0,uO0[i],uO1[i],n,e,z);
    if(t>tOcc){tOcc=t;nOcc=n;eOcc=e;heat=uO1[i].z;zr=z;}
  }
  vec3 dn;float dk;vec3 dhp;
  float tD=hitDeck(p0,dn,dk,dhp);
  float surf=0.;
  if(tD>tOcc){tOcc=tD;nOcc=dn;surf=dk;}
  else if(tOcc>-1e5)surf=4.;
  vec3 E=vec3(0.);
  float aSoot=0.;
  // ---------- plumes: importance-sampled around the ray's closest approach to each flow axis
  float tMid[NS];
  vec3 Ei[NS];
  for(int i=0;i<NS;i++){
    tMid[i]=-1e6; Ei[i]=vec3(0.);
    vec4 A=uS0[i],B=uS1[i],C=uS2[i],D3=uS3[i],D4=uS4[i];
    if(C.x<.002)continue;
    float re=A.w,len=C.y,ex=C.z;
    vec3 d=B.xyz;
    float Lc=len*(1.+ex*1.3);
    float Lmax=Lc+re*2.;
    float Rmax=re*(1.+ex*3.)+Lmax*(.045+.3*ex)+re*.5;
    vec3 w=p0-A.xyz;
    vec3 av=Vd-dot(Vd,d)*d,bw=w-dot(w,d)*d;
    float qa=dot(av,av),qb=2.*dot(av,bw),qc=dot(bw,bw)-Rmax*Rmax;
    float disc=qb*qb-4.*qa*qc;
    if(disc<=0.||qa<1e-6)continue;
    float sq=sqrt(disc);
    float ta=(-qb-sq)/(2.*qa),tb=(-qb+sq)/(2.*qa);
    float tc=-qb/(2.*qa);
    float s0=dot(w,d),sv=dot(Vd,d);
    if(abs(sv)>1e-4){
      float u0=(-re*.6-s0)/sv,u1=(Lmax-s0)/sv;
      ta=max(ta,min(u0,u1));tb=min(tb,max(u0,u1));
    }
    ta=max(ta,tOcc);
    if(tb<=ta)continue;
    tc=clamp(tc,ta,tb);
    float H=max(tb-tc,tc-ta);
    vec3 core,body,dia;float gain;kindCols(B.w,core,body,dia,gain);
    vec3 e1=normalize(cross(d,abs(d.z)>.9?vec3(0,1,0):vec3(0,0,1)));
    vec3 e2=cross(d,e1);
    float clusterN=D3.x+D3.z+D4.x;
    float er=clusterN>0.?D4.z:re;
    float floorZ=uDeckZ.z>.5?uDeckZ.w-uMisc.x:-1e6;
    float Ti=1.;
    vec3 acc=vec3(0.);
    const int N=22;
    for(int j=0;j<N;j++){
      float xs=1.-2.*(float(j)+dith)/float(N);
      float t=tc+H*xs*abs(xs);
      if(t<ta||t>tb)continue;
      float wgt=4.*H*abs(xs)/float(N);
      vec3 x=p0+t*Vd;
      vec3 r=x-A.xyz;
      float s=dot(r,d);
      vec3 q=r-s*d;
      float rho=length(q);
      float sp=max(s,0.);
      float R=re*(1.+ex*3.*(1.-exp(-sp/(re*1.3))))+sp*(.045+.3*ex);
      float start=smoothstep(-re*.3,re*.12,s);
      float below=smoothstep(floorZ-28.,floorZ-3.,x.z);
      float fade=pow(max(1.-sp/Lc,0.),1.5)*start*below;
      if(fade<=0.)continue;
      float u=rho/R;
      vec2 qq=vec2(dot(q,e1),dot(q,e2));
      float turb=noise3(vec3(qq/(re*.65),(sp-uClock*re*24.)/(re*1.2))+C.w);
      float turb2=noise3(vec3(qq/(re*1.9),sp/(re*3.)-uClock*7.)+C.w*1.7);
      float tw=smoothstep(0.,Lc*.3,sp);
      float edge=u+(turb2-.5)*.5*tw;
      float e2=edge*edge;
      float sea=exp(-e2*e2*1.6);
      float shell=exp(-pow((edge-.8)/.2,2.))*.9+exp(-edge*edge*2.2)*.3;
      float prof=mix(sea,shell,ex);
      float bodyE=prof*fade*mix(1.,.3+1.5*turb,tw*.8);
      float coreE=exp(-u*u*6.)*exp(-sp/(Lc*.22))*start*below+exp(-u*u*3.)*exp(-sp/(re*1.1))*start*.8;
      float nf=0.,diam=0.,rn=rho;
      if(clusterN>0.){
        float ang=atan(qq.y,qq.x);
        rn=1e4;
        for(int g=0;g<3;g++){
          float n=g==0?D3.x:g==1?D3.z:D4.x;
          float Rr=g==0?D3.y:g==1?D3.w:D4.y;
          if(n<.5)continue;
          float st=TAU/n;
          float kk=floor(ang/st+.5)*st;
          rn=min(rn,length(qq-Rr*vec2(cos(kk),sin(kk))));
        }
        float lnf=er*6.*(1.+ex*2.);
        nf=exp(-pow(rn/(er*(1.+sp/(er*4.))),2.)*1.5)*exp(-sp/lnf)*start*below;
      }
      float bk=B.w==1.?.75:B.w==0.?.08:B.w==3.?(clusterN>0.?1.05:.55):.32;
      vec3 em=body*bodyE*bk+core*coreE*(clusterN>0.?.12:.42)+core*nf*.8+dia*diam*1.3;
      em*=gain*C.x/re;
      acc+=Ti*em*wgt;
      if(D4.w>0.){
        float so=D4.w*exp(-pow((u-.8)/.35,2.))*exp(-sp/(re*3.5))*(.4+turb)*start;
        Ti*=exp(-so*wgt*.09);
      }
    }
    if(B.w!=1.&&ex<.98){
      float dsum=0.;
      if(clusterN>0.){
        for(int g=0;g<3;g++){
          float n=g==0?D3.x:g==1?D3.z:D4.x;
          float Rr=g==0?D3.y:g==1?D3.w:D4.y;
          for(int kk=0;kk<24;kk++){
            if(float(kk)>=n)break;
            float an=float(kk)*TAU/n;
            vec3 ac=A.xyz+Rr*(cos(an)*e1+sin(an)*e2);
            dsum+=diamondsOf(p0,ac,d,er,ex,tOcc,floorZ);
          }
        }
      } else dsum=diamondsOf(p0,A.xyz,d,er,ex,tOcc,floorZ);
      acc+=dia*dsum*1.3*gain*C.x/re*Ti;
    }
    Ei[i]=acc;
    aSoot=aSoot+(1.-aSoot)*(1.-Ti);
    tMid[i]=tc;
  }
  // ---------- smoke (trail + ground cloud), front to back
  vec3 sc=vec3(0.);float T=1.;
  float od[NS];
  for(int i=0;i<NS;i++)od[i]=0.;
  {
    float ta=1e6,tb=-1e6;
    float rise=uMisc.x;
    if(uTrailK.x>.002){
      float Rm=uTrailC.w*1.9+uTrailK.z*sqrt(max(uTrail.y,0.))*15.+uTrail.y*3.5+uTrailC.z+length(uWind.xy)*uTrail.y+40.;
      vec2 r2=coneRoots(p0,uTrailC.xy,0.,Rm,0.);
      float b0=min(r2.y,(uTrailK.y-uTrailS.x*.25-p0.z)/Vd.z);
      if(b0>r2.x){ta=min(ta,r2.x);tb=max(tb,b0);}
    }
    if(uGround.x>0.&&uGround.y+uGround.z>.002){
      float Rm=uGround2.z*1.3+length(uWind.xy)*uGround.x*.5;
      vec2 r2=coneRoots(p0,uGround2.xy,0.,Rm,0.);
      float zb=uGround.w-rise;
      float b0=min(r2.y,(zb+uGround2.z*.75-p0.z)/Vd.z);
      float a0=max(r2.x,(zb-uGround2.z*.3-p0.z)/Vd.z);
      if(b0>a0){ta=min(ta,a0);tb=max(tb,b0);}
    }
    ta=max(ta,tOcc);
    if(tb>ta){
      vec3 amb=mix(vec3(.66,.69,.75),uSky*.8+vec3(.16),.45);
      float t=tb-dith*14.;
      float lastStep=14.;
      for(int j=0;j<110;j++){
        if(t<=ta||T<.008||float(j)>=uWind.w)break;
        vec3 x=p0+t*Vd;
        gStep=1e5;
        float d1=trailD(x,2.),d2=groundD(x,2.);
        float stepNow=gStep>9e4?20.:gStep;
        float dens=d1+d2;
        if(dens>1e-3){
          float dt=stepNow;
          vec3 xs=x+SUN*48.;
          float pd=trailD(xs,1.)+groundD(xs,1.);
          float sunT=exp(-pd*1.5);
          float up=.55+.45*sunT;
          vec3 fire=vec3(0.);
          for(int i=0;i<NS;i++){
            vec4 A=uS0[i],B=uS1[i],C=uS2[i];
            if(C.x<.002)continue;
            vec3 core,body,dia;float gain;kindCols(B.w,core,body,dia,gain);
            vec3 lp=A.xyz+B.xyz*(C.y*.45);
            float dd=length(x-lp);
            float rr=A.w*2.2+C.y*.12;
            fire+=mix(body,vec3(1.,.55,.18),.6)*gain*C.x*exp(-dd/rr)*.5;
          }
          float steamy=uGround.z/(uGround.y+uGround.z+1e-3)*d2/dens;
          vec3 sunC=mix(vec3(1.,.97,.92),vec3(1.,1.,1.),steamy)*uWind.z;
          vec3 dust=mix(vec3(1.),vec3(.88,.76,.6),uGround2.w*(1.-steamy)*clamp(d2/dens,0.,1.));
          vec3 col=(amb*(.55+.35*up)+sunC*sunT*.62)*dust+fire*(1.-steamy*.6);
          float a=1.-exp(-dens*.022*dt);
          sc+=T*a*col;
          for(int i=0;i<NS;i++)if(t>tMid[i])od[i]+=dens*.022*dt;
          T*=1.-a;
        }
        t-=stepNow;
      }
    }
  }
  vec3 plumes=vec3(0.);
  for(int i=0;i<NS;i++)plumes+=Ei[i]*exp(-od[i]*.9);
  E+=plumes;
  float aF=clamp(dot(tonemap(plumes,1.),vec3(.3,.5,.2))*.75,0.,.9);
  // ---------- light on surfaces: bodies, bells, deck top, openings
  if(surf>0.){
    vec3 x=p0+tOcc*Vd;
    float edge=surf==4.?smoothstep(0.,px*1.6,eOcc):1.;
    vec3 Ls=plumeLight(x,nOcc,surf==3.?1.:.15);
    float k=surf==3.?2.2:surf==1.?.9:.85;
    vec3 add=Ls*k*edge;
    if(surf==4.&&heat>0.){
      float h=heat*(.6+.4*(1.-zr));
      add+=blackbody(h)*edge*(.85+.15*noise2(vec2(zr*20.,uClock*3.)));
    }
    E+=add*T;
  }
  // ---------- igniter sparks (hydrogen burn-off)
  if(uMisc.w>.002){
    vec3 c=uSpark.xyz;
    float sR=uSpark.w;
    vec3 s=vec3(0.);
    for(int j=0;j<48;j++){
      float fj=float(j);
      float h1=hash12(vec2(fj,1.7)),h2=hash12(vec2(fj,7.3)),h3=hash12(vec2(fj,3.1));
      float life=.4+h3*.55;
      float ph=fract(uClock/life+h1);
      float ang=h2*TAU;
      vec3 dir=normalize(vec3(cos(ang),sin(ang),-.15-h1*.5));
      float spd=sR*(2.4+h3*2.4);
      vec3 o=c+vec3(cos(ang*3.),sin(ang*3.),0.)*sR*.3;
      vec3 p=o+dir*spd*ph-vec3(0,0,50.*ph*ph);
      vec3 vel=dir*spd-vec3(0,0,100.*ph);
      vec2 a=project(p),b=project(p-vel*.06);
      vec2 pa=vb-a,ba=b-a;
      float hh=clamp(dot(pa,ba)/max(dot(ba,ba),1e-4),0.,1.);
      float dd=length(pa-ba*hh);
      float wv=max(px*uK*1.3,.35);
      s+=vec3(1.,.7,.32)*exp(-dd*dd/(wv*wv))*(1.-ph)*(1.-ph)*1.8;
    }
    E+=s*uMisc.w*T;
  }
  // ---------- ignition flash around the pad
  if(uMisc.z>.002){
    vec3 c=vec3(uGround2.xy,uDeckZ.x-uMisc.x+20.);
    vec3 w=c-p0;
    float tcf=dot(w,Vd);
    float dd=length(w-tcf*Vd);
    E+=vec3(1.,.8,.5)*uMisc.z*exp(-dd*dd/(240.*240.))*1.3;
  }
  // ---------- vapour cone (transonic): a thin conical sheet, exact ray intersections, no sampling noise
  vec3 vc=vec3(0.);float va=0.;
  if(uMisc.y>.002){
    float zt=uVap.x,zb=uVap.y,rb=uVap.z,kc=-.34;
    vec2 r2=coneRoots(p0,vec2(0.),zt,rb,kc);
    for(int j=0;j<2;j++){
      float t=j==0?r2.y:r2.x;
      if(t<tOcc||t>1e5)continue;
      vec3 x=p0+t*Vd;
      if(x.z>zt||x.z<zb)continue;
      float z=(zt-x.z)/(zt-zb);
      vec3 n=normalize(vec3(normalize(x.xy),-kc));
      float cosv=abs(dot(n,Vd));
      float ang=atan(x.y,x.x);
      float streak=noise3(vec3(cos(ang)*4.,sin(ang)*4.,x.z/(rb*1.1)-uClock*5.))*.6+noise3(vec3(cos(ang)*11.,sin(ang)*11.,x.z/(rb*.35)-uClock*9.))*.4;
      float dens=smoothstep(0.,.05,z)*exp(-z*3.2)*(.25+streak)*uMisc.y;
      float a=clamp(dens*.42*min(1./max(cosv,.05),3.5)*smoothstep(.0,.12,cosv)*smoothstep(0.,14.,r2.y-r2.x),0.,.8);
      vec3 col=vec3(.94,.95,.97)*(.75+.25*max(dot(n,SUN),0.));
      vc+=(1.-va)*a*col;
      va+=(1.-va)*a;
    }
  }
  // ---------- compose
  vec3 emis=tonemap(E,1.);
  vec3 rgb=sc+emis*(1.-aSoot*.7)+vec3(.06,.05,.04)*aSoot;
  float alpha=1.-T*(1.-aSoot)*(1.-aF);
  rgb=vc+(1.-va)*rgb;
  alpha=va+(1.-va)*alpha;
  float m=max(max(rgb.r,rgb.g),max(rgb.b,alpha));
  float nd=(hash12(gl_FragCoord.xy+fract(uClock*.61)*91.)+hash12(gl_FragCoord.yx*1.37+fract(uClock*.37)*57.)-1.)/255.;
  rgb=max(rgb+nd*smoothstep(0.,1.5/255.,m),0.);
  gl_FragColor=vec4(min(rgb,vec3(1.)),clamp(alpha,0.,1.));
}`;


// Browser runtime, inlined after the kit's GLSL_ISO (glScript()). Exposes `FX`.
export const FX_RUNTIME = `
let FXfixed = false;
const FX = (() => {
  const NS = ${NS}, NO = ${NO};
  let gl = null, prog = null, loc = {}, canvas = null, scale = 0.8, times = [], lastNow = 0, painted = false;
  const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";
  function init(cv) {
    canvas = cv;
    gl = cv.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; } return s; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, GLSL_ISO + FX_FRAGMENT);
    if (!vs || !fs) { gl = null; return false; }
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); gl = null; return false; }
    gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const pa = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(pa); gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uCanvas","uView","uOrigin","uK","uCam","uTime","uS0","uS1","uS2","uS3","uS4","uO0","uO1","uDeck","uDeckZ","uHole","uTrail","uTrailC","uTrailK","uTrailS","uGround","uGround2","uMisc","uVap","uSpark","uWind","uSky","uClock","uGreen"]) loc[n] = gl.getUniformLocation(prog, n);
    return true;
  }
  const v4 = (n, arr) => gl.uniform4fv(loc[n], arr);
  function pack(list, count, f) { const a = new Float32Array(count * 4); list.slice(0, count).forEach((x, i) => a.set(f(x), i * 4)); return a; }
  // adaptive resolution: keep the frame under ~20 ms
  function adapt(now) {
    if (FXfixed) return;
    if (lastNow) times.push(now - lastNow);
    lastNow = now;
    if (times.length >= 24) {
      const m = times.sort((a, b) => a - b)[12];
      times = [];
      if (m > 21) scale = Math.max(0.42, scale * 0.86);
      else if (m < 17.6 && scale < 1) scale = Math.min(1, scale * 1.08);
    }
  }
  function draw(st, vb, cam, now) {
    if (!gl) return;
    adapt(now);
    const r = canvas.getBoundingClientRect();
    const ratio = Math.min(1.5, devicePixelRatio || 1) * scale;
    const W = Math.max(1, Math.round(r.width * ratio)), H = Math.max(1, Math.round(r.height * ratio));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    gl.uniform2f(loc.uCanvas, W, H);
    gl.uniform2f(loc.uView, vb[2], vb[3]);
    gl.uniform2f(loc.uOrigin, cam.origin[0] - vb[0], cam.origin[1] - vb[1]);
    gl.uniform1f(loc.uK, cam.k);
    gl.uniform4f(loc.uCam, ...cam.cam);
    gl.uniform1f(loc.uTime, st.clock);
    gl.uniform1f(loc.uClock, st.clock);
    const S = st.sources;
    v4("uS0", pack(S, NS, (s) => [s.p[0], s.p[1], s.p[2], s.re]));
    v4("uS1", pack(S, NS, (s) => [s.d[0], s.d[1], s.d[2], s.kind]));
    v4("uS2", pack(S, NS, (s) => [s.power, s.len, s.ex || 0, s.seed || 0]));
    v4("uS3", pack(S, NS, (s) => s.rings ? [s.rings[0][0], s.rings[0][1], (s.rings[1] || [0, 0])[0], (s.rings[1] || [0, 0])[1]] : [0, 0, 0, 0]));
    v4("uS4", pack(S, NS, (s) => s.rings ? [(s.rings[2] || [0, 0])[0], (s.rings[2] || [0, 0])[1], s.er || 1, s.soot || 0] : [0, 0, s.re, s.soot || 0]));
    v4("uO0", pack(st.occ, NO, (o) => o.on ? [o.x, o.y, o.z0, o.z1] : [0, 0, 1, 0]));
    v4("uO1", pack(st.occ, NO, (o) => [o.r0, o.r1, o.heat || 0, 0]));
    const d = st.deck;
    gl.uniform4f(loc.uDeck, ...(d ? d.rect : [0, 0, 0, 0]));
    gl.uniform4f(loc.uDeckZ, d ? d.top : 0, d ? d.bottom : 0, d ? 1 : 0, d ? (d.floor ?? d.top) : 0);
    v4("uHole", pack(d ? d.holes : [], 4, (h) => h));
    const T = st.trail;
    gl.uniform4f(loc.uTrail, T.a, T.t, T.t0, T.t1);
    gl.uniform4f(loc.uTrailC, T.c[0], T.c[1], T.half, T.r0);
    gl.uniform4f(loc.uTrailK, T.strength, T.z, T.growth, T.thin);
    gl.uniform4f(loc.uTrailS, T.start || 200, 0, 0, 0);
    const g = st.ground;
    gl.uniform4f(loc.uGround, g.tau, g.smoke, g.steam, g.z);
    gl.uniform4f(loc.uGround2, g.c[0], g.c[1], g.rmax, g.dust || 0);
    gl.uniform1f(loc.uGreen, st.green || 0);
    gl.uniform4f(loc.uMisc, st.rise, st.vapor, st.flash, st.sparks);
    gl.uniform4f(loc.uVap, ...st.vap, 0);
    gl.uniform4f(loc.uSpark, ...st.spark);
    gl.uniform4f(loc.uWind, st.wind[0], st.wind[1], st.sun, scale < 0.6 ? 56 : 100);
    gl.uniform3f(loc.uSky, ...st.sky);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    painted = true;
  }
  function clear() { if (gl && painted) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); painted = false; } lastNow = 0; times = []; }
  return { init, draw, clear, get ok() { return !!gl; }, get scale() { return scale; }, set scale(v) { scale = v; }, fixed: false };
})();
`;
