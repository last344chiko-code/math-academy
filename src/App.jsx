import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBwfZi2MZo9JjoYgR0a4NgO5rc8BrTlCcY",
  authDomain: "bom-schedule.firebaseapp.com",
  projectId: "bom-schedule",
  storageBucket: "bom-schedule.firebasestorage.app",
  messagingSenderId: "72249122187",
  appId: "1:72249122187:web:0babd281ecd16e6236238e"
};
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const DAYS  = ["월","화","수","목","금","토","일"];
const TIMES = [];
for(let h=9;h<=21;h++){TIMES.push(`${String(h).padStart(2,'0')}:00`);TIMES.push(`${String(h).padStart(2,'0')}:30`);}
TIMES.push("22:00");

const GRADES   = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];
const GRADE_ORDER = Object.fromEntries(GRADES.map((g,i)=>[g,i]));
const SUBJECTS = ["수학","과학","수학+과학"];
const TCOLORS  = ["#3b82f6","#f59e0b","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];
const HW_OPTS  = ["a","b","c","d","n"];
const HW_COLOR = {a:"#10b981",b:"#3b82f6",c:"#f59e0b",d:"#ef4444",n:"#94a3b8"};
const HW_DESC  = {a:"A — 완료",b:"B — 대부분",c:"C — 절반",d:"D — 미흡",n:"N — 미제출"};
const ATT_COLOR= {present:"#10b981",absent:"#ef4444",makeup:"#8b5cf6"};
const ATT_LABEL= {present:"출석",absent:"결석",makeup:"보강"};

const today = () => new Date().toISOString().split("T")[0];
const monthDates = ym => {
  const [y,m] = ym.split("-").map(Number);
  return Array.from({length:new Date(y,m,0).getDate()},(_,i)=>`${ym}-${String(i+1).padStart(2,'0')}`);
};
const sortStudents = arr => [...arr].sort((a,b)=>{
  const gd=(GRADE_ORDER[a.grade]??99)-(GRADE_ORDER[b.grade]??99);
  return gd!==0?gd:(a.name||"").localeCompare(b.name||"","ko");
});

const C = {
  bg:"#f1f5f9",card:"#ffffff",card2:"#f8fafc",
  border:"#e2e8f0",text:"#1e293b",text2:"#475569",muted:"#94a3b8",
  accent:"#3b82f6",font:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"
};

/* ── 모바일 감지 ── */
function useIsMobile(){
  const [mob,setMob]=useState(false);
  useEffect(()=>{
    const check=()=>setMob(window.innerWidth<768);
    check();
    window.addEventListener("resize",check);
    return()=>window.removeEventListener("resize",check);
  },[]);
  return mob;
}

/* ── 공통 UI ── */
const Tag=({c="#3b82f6",children})=>(
  <span style={{fontSize:"0.68rem",padding:"2px 8px",borderRadius:"20px",background:c+"18",color:c,fontFamily:C.font,fontWeight:600,whiteSpace:"nowrap",border:`1px solid ${c}30`}}>{children}</span>
);
const Btn=({children,v="primary",sm,style:xs,...p})=>{
  const m={primary:{bg:"#3b82f6",fg:"#fff",hv:"#2563eb"},ghost:{bg:"#f1f5f9",fg:C.text2,hv:"#e2e8f0"},danger:{bg:"#ef4444",fg:"#fff",hv:"#dc2626"},success:{bg:"#10b981",fg:"#fff",hv:"#059669"},purple:{bg:"#8b5cf6",fg:"#fff",hv:"#7c3aed"}};
  const st=m[v]||m.primary;
  return <button {...p} style={{border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:C.font,fontWeight:600,padding:sm?"4px 12px":"8px 18px",fontSize:sm?"0.74rem":"0.85rem",background:st.bg,color:st.fg,transition:"all .15s",...xs}}
    onMouseEnter={e=>e.currentTarget.style.background=st.hv}
    onMouseLeave={e=>e.currentTarget.style.background=st.bg}
  >{children}</button>;
};
const Inp=({label,...p})=>(
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>{label}</div>}
    <input {...p} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,...p.style}}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
  </div>
);
const Sel=({label,opts,...p})=>(
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>{label}</div>}
    <select {...p} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font}}>
      {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  </div>
);
const Modal=({title,onClose,wide,zIndex=200,children})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.45)",zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",backdropFilter:"blur(2px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:C.card,borderRadius:"16px",padding:"1.75rem",width:"100%",maxWidth:wide?"960px":"500px",maxHeight:"93vh",overflowY:"auto",border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,.15)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
        <h3 style={{margin:0,color:C.text,fontSize:"1.05rem",fontFamily:C.font,fontWeight:700}}>{title}</h3>
        <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:"8px",color:C.muted,cursor:"pointer",fontSize:"1.1rem",width:"32px",height:"32px",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ── 로그인 ── */
function LoginScreen(){
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoad]=useState(false);
  async function handleLogin(){if(!email||!pw)return setErr("이메일과 비밀번호를 입력하세요");setLoad(true);setErr("");try{await signInWithEmailAndPassword(auth,email,pw);}catch(e){setErr("이메일 또는 비밀번호가 올바르지 않습니다");}setLoad(false);}
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#eff6ff,#f0fdf4)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.font}}>
      <div style={{background:C.card,borderRadius:"20px",padding:"2.5rem 2rem",width:"100%",maxWidth:"380px",boxShadow:"0 20px 60px rgba(0,0,0,.1)",border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"14px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",margin:"0 auto 1rem"}}>📐</div>
          <div style={{fontWeight:800,fontSize:"1.4rem",color:C.text}}>봄 학원 관리</div>
          <div style={{color:C.muted,fontSize:"0.82rem",marginTop:"4px"}}>Bom Schedule</div>
        </div>
        <Inp label="이메일" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@academy.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        <Inp label="비밀번호" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호 입력" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        {err&&<div style={{color:"#ef4444",fontSize:"0.78rem",marginBottom:"0.85rem",background:"#fef2f2",padding:"8px 12px",borderRadius:"8px"}}>{err}</div>}
        <Btn style={{width:"100%",padding:"11px"}} onClick={handleLogin} disabled={loading}>{loading?"로그인 중...":"로그인"}</Btn>
      </div>
    </div>
  );
}

/* ── 학생 시간표 편집기 ── */
function StudentScheduleEditor({schedule,onChange,teachers,defaultTeacherId}){
  const getSlot=(d,t)=>schedule.find(s=>s.day===d&&s.time===t);
  const on=(d,t)=>!!getSlot(d,t);
  const tgl=(d,t)=>{if(on(d,t))onChange(schedule.filter(s=>!(s.day===d&&s.time===t)));else onChange([...schedule,{day:d,time:t,teacherId:defaultTeacherId||null}]);};
  const chT=(d,t,tid)=>onChange(schedule.map(s=>(s.day===d&&s.time===t)?{...s,teacherId:tid||null}:s));
  return(
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:"420px"}}>
        <thead><tr><th style={{padding:"4px 6px",color:C.muted,fontSize:"0.66rem",textAlign:"left",width:"52px"}}></th>{DAYS.map(d=><th key={d} style={{padding:"4px 5px",color:C.text2,fontSize:"0.74rem",textAlign:"center",minWidth:"56px",fontWeight:600}}>{d}</th>)}</tr></thead>
        <tbody>
          {TIMES.map(t=>{
            const isHour=t.endsWith(":00");
            return(
              <tr key={t} style={{borderTop:isHour?`1px solid ${C.border}`:`1px dashed ${C.border}`}}>
                <td style={{padding:"1px 6px",color:isHour?C.text2:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none"}}>{t}</td>
                {DAYS.map(d=>{
                  const slot=getSlot(d,t);const active=!!slot;
                  const teacher=active&&slot.teacherId?teachers?.find(tc=>tc.id===slot.teacherId):null;
                  return(
                    <td key={d} style={{padding:"1px 2px",verticalAlign:"top"}}>
                      <div onClick={()=>tgl(d,t)} style={{width:"100%",height:"22px",borderRadius:isHour?"3px 3px 0 0":"0 0 3px 3px",background:active?(teacher?.color+"22"||"#dbeafe"):"#f8fafc",border:`1.5px solid ${active?(teacher?.color||C.accent):C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {active&&isHour&&<span style={{color:teacher?.color||C.accent,fontSize:"0.5rem",fontWeight:700}}>{teacher?teacher.name.slice(0,2):"●"}</span>}
                      </div>
                      {active&&<select value={slot.teacherId||""} onChange={e=>chT(d,t,e.target.value)} onClick={e=>e.stopPropagation()} style={{width:"100%",background:C.card2,border:`1px solid ${teacher?.color||C.border}`,borderRadius:"3px",color:C.text,fontSize:"0.6rem",padding:"1px",marginTop:"1px",fontFamily:C.font}}>
                        <option value="">미배정</option>{teachers?.map(tc=><option key={tc.id} value={tc.id}>{tc.name}</option>)}
                      </select>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p style={{color:C.muted,fontSize:"0.7rem",marginTop:"5px",fontFamily:C.font}}>※ 셀 클릭으로 추가/제거 | 드롭다운으로 담당 선생님 변경</p>
    </div>
  );
}

/* ── 모바일 전용: 요일탭 시간표 ── */
function MobileSched({teachers,students,onStudentClick}){
  const [selDay,setSelDay]=useState(DAYS[0]);
  const getTeacher=(s,time)=>{const sc=s.schedule?.find(sc=>sc.day===selDay&&sc.time===time);return teachers.find(t=>t.id===(sc?.teacherId||s.teacherId));};
  const blocks=useMemo(()=>TIMES.filter(t=>t.endsWith(":00")).map(ht=>{
    const h=ht.split(":")[0];
    const s0=students.filter(s=>s.schedule?.some(sc=>sc.day===selDay&&sc.time===ht)).map(s=>({...s,_t:getTeacher(s,ht)}));
    const s3=students.filter(s=>s.schedule?.some(sc=>sc.day===selDay&&sc.time===`${h}:30`)).map(s=>({...s,_t:getTeacher(s,`${h}:30`)}));
    return{ht,h,s0,s3,any:s0.length>0||s3.length>0};
  }).filter(b=>b.any),[selDay,students,teachers]);

  return(
    <div>
      <div style={{display:"flex",gap:"4px",marginBottom:"1rem",overflowX:"auto",paddingBottom:"4px",WebkitOverflowScrolling:"touch"}}>
        {DAYS.map(d=>{
          const has=students.some(s=>s.schedule?.some(sc=>sc.day===d));
          return<button key={d} onClick={()=>setSelDay(d)} style={{flexShrink:0,border:`2px solid ${selDay===d?C.accent:C.border}`,borderRadius:"10px",padding:"7px 16px",cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.85rem",background:selDay===d?C.accent:"#fff",color:selDay===d?"#fff":has?C.text2:C.muted}}>{d}</button>;
        })}
      </div>
      {blocks.length===0
        ?<div style={{textAlign:"center",padding:"2.5rem",color:C.muted,background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,fontFamily:C.font}}>{selDay}요일 수업 없음</div>
        :<div>{blocks.map(({ht,h,s0,s3})=>(
          <div key={ht} style={{marginBottom:"10px",background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{background:C.accent+"12",padding:"7px 14px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:"0.9rem",color:C.accent,fontFamily:C.font}}>{ht}</span>
            </div>
            <div style={{padding:"8px 12px"}}>
              {s0.map(s=>(
                <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:s._t?s._t.color+"15":"#eff6ff",borderLeft:`3px solid ${s._t?.color||C.accent}`,borderRadius:"8px",padding:"9px 12px",marginBottom:"6px",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span style={{fontWeight:700,color:s._t?.color||C.accent,fontFamily:C.font,fontSize:"0.92rem"}}>{s.name}</span>
                  <span style={{color:C.muted,marginLeft:"6px",fontSize:"0.75rem",fontFamily:C.font}}>{s.grade}</span>
                  {s._t&&<div style={{color:s._t.color,fontSize:"0.72rem",fontFamily:C.font,marginTop:"2px"}}>{s._t.name}</div>}
                </div>
              ))}
              {s3.length>0&&(
                <div style={{marginTop:s0.length>0?"6px":0}}>
                  <div style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font,fontWeight:600,marginBottom:"4px"}}>{h}:30</div>
                  {s3.map(s=>(
                    <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:s._t?s._t.color+"15":"#eff6ff",borderLeft:`3px solid ${s._t?.color||C.accent}`,borderRadius:"8px",padding:"9px 12px",marginBottom:"6px",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <span style={{fontWeight:700,color:s._t?.color||C.accent,fontFamily:C.font,fontSize:"0.92rem"}}>{s.name}</span>
                      <span style={{color:C.muted,marginLeft:"6px",fontSize:"0.75rem",fontFamily:C.font}}>{s.grade}</span>
                      {s._t&&<div style={{color:s._t.color,fontSize:"0.72rem",fontFamily:C.font,marginTop:"2px"}}>{s._t.name}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}</div>
      }
    </div>
  );
}

/* ── 모바일 전용: 선생님별 요일탭 ── */
function MobileTeacherSched({teacher,students,onStudentClick}){
  const [selDay,setSelDay]=useState(DAYS[0]);
  const getSlots=(day,time)=>students.filter(s=>{
    const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);
    return sc&&(sc.teacherId||s.teacherId)===teacher.id;
  });
  const myStudents=[...new Map(students.filter(s=>s.schedule?.some(sc=>(sc.teacherId||s.teacherId)===teacher.id)).map(s=>[s.id,s])).values()];
  const blocks=useMemo(()=>TIMES.filter(t=>t.endsWith(":00")).map(ht=>{
    const h=ht.split(":")[0];
    const s0=getSlots(selDay,ht);
    const s3=getSlots(selDay,`${h}:30`);
    return{ht,h,s0,s3,any:s0.length>0||s3.length>0};
  }).filter(b=>b.any),[selDay,students,teacher.id]);

  return(
    <div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1rem"}}>
        {myStudents.map(s=>(
          <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",border:`1px solid ${teacher.color}30`}}
            onMouseEnter={e=>e.currentTarget.style.background=teacher.color+"28"} onMouseLeave={e=>e.currentTarget.style.background=teacher.color+"15"}>
            <span style={{color:teacher.color,fontWeight:700,fontSize:"0.8rem",fontFamily:C.font}}>{s.name}</span>
            <span style={{color:C.muted,fontSize:"0.7rem",marginLeft:"5px",fontFamily:C.font}}>{s.grade}</span>
          </div>
        ))}
        {myStudents.length===0&&<span style={{color:C.muted,fontSize:"0.8rem",fontFamily:C.font}}>담당 원생 없음</span>}
      </div>
      <div style={{display:"flex",gap:"4px",marginBottom:"1rem",overflowX:"auto",paddingBottom:"4px"}}>
        {DAYS.map(d=>{
          const has=myStudents.some(s=>s.schedule?.some(sc=>sc.day===d));
          return<button key={d} onClick={()=>setSelDay(d)} style={{flexShrink:0,border:`2px solid ${selDay===d?teacher.color:C.border}`,borderRadius:"10px",padding:"7px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.85rem",background:selDay===d?teacher.color+"22":"#fff",color:selDay===d?teacher.color:has?C.text2:C.muted}}>{d}</button>;
        })}
      </div>
      {blocks.length===0
        ?<div style={{textAlign:"center",padding:"2rem",color:C.muted,background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,fontFamily:C.font}}>{selDay}요일 수업 없음</div>
        :<div>{blocks.map(({ht,h,s0,s3})=>(
          <div key={ht} style={{marginBottom:"10px",background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{background:teacher.color+"12",padding:"7px 14px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:"0.9rem",color:teacher.color,fontFamily:C.font}}>{ht}</span>
            </div>
            <div style={{padding:"8px 12px"}}>
              {s0.map(s=>(
                <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"8px",padding:"9px 12px",marginBottom:"6px",cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span style={{fontWeight:700,color:teacher.color,fontFamily:C.font}}>{s.name}</span>
                  <span style={{color:C.muted,marginLeft:"6px",fontSize:"0.75rem",fontFamily:C.font}}>{s.grade}</span>
                </div>
              ))}
              {s3.length>0&&(
                <div style={{marginTop:s0.length>0?"6px":0}}>
                  <div style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font,fontWeight:600,marginBottom:"4px"}}>{h}:30</div>
                  {s3.map(s=>(
                    <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"8px",padding:"9px 12px",marginBottom:"6px",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <span style={{fontWeight:700,color:teacher.color,fontFamily:C.font}}>{s.name}</span>
                      <span style={{color:C.muted,marginLeft:"6px",fontSize:"0.75rem",fontFamily:C.font}}>{s.grade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}</div>
      }
    </div>
  );
}

/* ── PC 전체 시간표 ── */
function FullSched({teachers,students,onStudentClick}){
  const [filterDays,setFilterDays]=useState([...DAYS]);
  const showDays=DAYS.filter(d=>filterDays.includes(d));
  const toggleDay=d=>setFilterDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);
  const getTeacher=(s,day,time)=>{const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);return teachers.find(t=>t.id===(sc?.teacherId||s.teacherId));};
  return(
    <div>
      <div style={{display:"flex",gap:"5px",marginBottom:"1rem",flexWrap:"wrap"}}>
        {DAYS.map(d=><button key={d} onClick={()=>toggleDay(d)} style={{border:`1.5px solid ${filterDays.includes(d)?C.accent:C.border}`,borderRadius:"8px",padding:"4px 12px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.76rem",background:filterDays.includes(d)?C.accent:"#fff",color:filterDays.includes(d)?"#fff":C.text2,transition:"all .15s"}}>{d}</button>)}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"460px"}}>
          <thead>
            <tr style={{background:C.card2}}>
              <th style={{padding:"8px 10px",color:C.muted,fontSize:"0.7rem",textAlign:"left",minWidth:"52px",borderBottom:`2px solid ${C.border}`}}>시간</th>
              {showDays.map(d=><th key={d} style={{padding:"8px 10px",color:C.text2,fontSize:"0.78rem",textAlign:"center",borderBottom:`2px solid ${C.border}`,minWidth:"88px",fontWeight:700}}>{d}요일</th>)}
            </tr>
          </thead>
          <tbody>
            {TIMES.map(time=>{
              const isHour=time.endsWith(":00");
              const byday={};
              showDays.forEach(d=>{byday[d]=students.filter(s=>s.schedule?.some(sc=>sc.day===d&&sc.time===time)).map(s=>({...s,_teacher:getTeacher(s,d,time)}));});
              return(
                <tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`,background:C.card}}>
                  <td style={{padding:"3px 10px",color:isHour?C.text2:"transparent",fontSize:"0.68rem",whiteSpace:"nowrap",background:C.card2,userSelect:"none",fontWeight:isHour?600:400}}>{time}</td>
                  {showDays.map(d=>(
                    <td key={d} style={{padding:"2px 4px",verticalAlign:"top",minWidth:"88px"}}>
                      {isHour&&byday[d].map(s=>(
                        <div key={s.id} onClick={()=>onStudentClick(s)}
                          style={{background:s._teacher?s._teacher.color+"15":"#eff6ff",borderLeft:`3px solid ${s._teacher?.color||C.accent}`,borderRadius:"6px",padding:"3px 7px",marginBottom:"3px",fontSize:"0.72rem",color:C.text,fontFamily:C.font,lineHeight:1.5,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=s._teacher?s._teacher.color+"28":"#dbeafe";e.currentTarget.style.transform="translateX(2px)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=s._teacher?s._teacher.color+"15":"#eff6ff";e.currentTarget.style.transform="none";}}>
                          <span style={{fontWeight:700,color:s._teacher?.color||C.accent}}>{s.name}</span>
                          <span style={{color:C.muted,marginLeft:"4px",fontSize:"0.64rem"}}>{s.grade}</span>
                          {s._teacher&&<div style={{color:s._teacher.color,fontSize:"0.62rem"}}>{s._teacher.name}</div>}
                        </div>
                      ))}
                      {!isHour&&byday[d].map(s=>(
                        <div key={s.id} onClick={()=>onStudentClick(s)} style={{height:"7px",borderRadius:"3px",background:s._teacher?s._teacher.color+"40":"#bfdbfe",marginBottom:"2px",cursor:"pointer"}}/>
                      ))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── PC 선생님별 시간표 ── */
function TeacherSched({teacher,students,onStudentClick}){
  const getStudentsForSlot=(day,time)=>students.filter(s=>{
    const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);
    return sc&&(sc.teacherId||s.teacherId)===teacher.id;
  });
  const myStudents=[...new Map(students.filter(s=>s.schedule?.some(sc=>(sc.teacherId||s.teacherId)===teacher.id)).map(s=>[s.id,s])).values()];
  return(
    <div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1rem"}}>
        {myStudents.map(s=>(
          <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",border:`1px solid ${teacher.color}30`}}
            onMouseEnter={e=>e.currentTarget.style.background=teacher.color+"28"} onMouseLeave={e=>e.currentTarget.style.background=teacher.color+"15"}>
            <span style={{color:teacher.color,fontWeight:700,fontSize:"0.8rem",fontFamily:C.font}}>{s.name}</span>
            <span style={{color:C.muted,fontSize:"0.7rem",marginLeft:"5px",fontFamily:C.font}}>{s.grade}</span>
          </div>
        ))}
        {myStudents.length===0&&<span style={{color:C.muted,fontSize:"0.8rem",fontFamily:C.font}}>담당 원생 없음</span>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"420px"}}>
          <thead>
            <tr style={{background:C.card2}}>
              <th style={{padding:"5px 10px",color:C.muted,fontSize:"0.68rem",textAlign:"left",width:"52px",borderBottom:`2px solid ${C.border}`}}></th>
              {DAYS.map(d=><th key={d} style={{padding:"5px 10px",color:C.text2,fontSize:"0.76rem",textAlign:"center",minWidth:"64px",fontWeight:700,borderBottom:`2px solid ${C.border}`}}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIMES.map(time=>{
              const isHour=time.endsWith(":00");
              return(
                <tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`}}>
                  <td style={{padding:"2px 10px",color:isHour?C.text2:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none",background:C.card2,fontWeight:600}}>{time}</td>
                  {DAYS.map(day=>{
                    const here=getStudentsForSlot(day,time);
                    return(
                      <td key={day} style={{padding:"1px 3px",verticalAlign:"top",minWidth:"64px"}}>
                        {isHour&&here.map(s=>(
                          <div key={s.id} onClick={()=>onStudentClick(s)}
                            style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"5px",padding:"2px 6px",marginBottom:"2px",fontSize:"0.7rem",color:C.text,fontFamily:C.font,cursor:"pointer"}}
                            onMouseEnter={e=>e.currentTarget.style.background=teacher.color+"28"}
                            onMouseLeave={e=>e.currentTarget.style.background=teacher.color+"15"}>
                            <div style={{fontWeight:700,color:teacher.color}}>{s.name}</div>
                            <div style={{color:C.muted,fontSize:"0.62rem"}}>{s.grade}</div>
                          </div>
                        ))}
                        {!isHour&&here.map(s=>(
                          <div key={s.id} onClick={()=>onStudentClick(s)} style={{height:"7px",borderRadius:"3px",background:teacher.color+"40",marginBottom:"2px",cursor:"pointer"}}/>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── PDF ── */
function PdfModal({teachers,students,onClose}){
  const [selTeacher,setSelTeacher]=useState("all");
  const [selDays,setSelDays]=useState([...DAYS]);
  const [timeFrom,setTimeFrom]=useState("09:00");
  const [timeTo,setTimeTo]=useState("22:00");
  const toggleDay=d=>setSelDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);
  const showDays=DAYS.filter(d=>selDays.includes(d));
  const showTimes=TIMES.filter(t=>t>=timeFrom&&t<=timeTo);
  const getTeacher=(s,day,time)=>{const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);return teachers.find(t=>t.id===(sc?.teacherId||s.teacherId));};
  const getSlots=(day,time)=>students.filter(s=>{
    const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);
    if(!sc) return false;
    return selTeacher==="all"||(sc.teacherId||s.teacherId)===selTeacher;
  }).map(s=>({...s,_teacher:getTeacher(s,day,time)}));
  function doPrint(){
    const tName=selTeacher!=="all"?teachers.find(t=>t.id===selTeacher)?.name||"":"전체";
    const w=window.open("","_blank","width=900,height=700");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>시간표</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;padding:20px;background:#fff;color:#1e293b;font-size:11px}
h2{font-size:15px;margin-bottom:4px}p{font-size:10px;color:#94a3b8;margin-bottom:12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center;vertical-align:top;min-width:70px}
th{background:#f8fafc;font-weight:700;font-size:11px;color:#475569}.tc{text-align:left;color:#94a3b8;font-size:10px;white-space:nowrap;min-width:50px;background:#f8fafc}.tc.h{color:#1e293b;font-weight:700}
.hl{border-top:1px dashed #e2e8f0!important}.sb{border-radius:4px;padding:2px 5px;margin-bottom:2px;text-align:left;font-size:10px;line-height:1.5}.hb{height:5px;border-radius:2px;margin-bottom:2px}
@media print{body{padding:10px}}</style></head><body>
<h2>봄 학원 시간표 — ${tName}</h2><p>출력일: ${new Date().toLocaleDateString("ko-KR")}</p>
<table><thead><tr><th class="tc">시간</th>${showDays.map(d=>`<th>${d}요일</th>`).join("")}</tr></thead>
<tbody>${showTimes.map(time=>{
  const isHour=time.endsWith(":00");
  return `<tr${!isHour?' class="hl"':''}><td class="tc${isHour?' h':''}">${isHour?time:""}</td>${showDays.map(d=>{
    const here=getSlots(d,time);
    return `<td>${isHour?here.map(s=>`<div class="sb" style="background:${s._teacher?.color||"#3b82f6"}15;border-left:3px solid ${s._teacher?.color||"#3b82f6"}"><strong style="color:${s._teacher?.color||"#3b82f6"}">${s.name}</strong> <span style="color:#94a3b8">${s.grade}</span>${s._teacher?`<br><span style="color:${s._teacher.color};font-size:9px">${s._teacher.name}</span>`:""}</div>`).join("")
    :here.map(s=>`<div class="hb" style="background:${s._teacher?.color||"#3b82f6"}40"></div>`).join("")}</td>`;
  }).join("")}</tr>`;
}).join("")}</tbody></table></body></html>`;
    w.document.write(html);w.document.close();setTimeout(()=>w.print(),800);
  }
  return(
    <div>
      <div style={{background:C.card2,borderRadius:"12px",padding:"1rem",marginBottom:"1rem",border:`1px solid ${C.border}`}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem",marginBottom:"0.75rem"}}>
          <div>
            <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>선생님 필터</div>
            <select value={selTeacher} onChange={e=>setSelTeacher(e.target.value)} style={{width:"100%",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.85rem",outline:"none",fontFamily:C.font}}>
              <option value="all">전체</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
            <div>
              <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>시작</div>
              <select value={timeFrom} onChange={e=>setTimeFrom(e.target.value)} style={{width:"100%",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.85rem",outline:"none",fontFamily:C.font}}>
                {TIMES.filter(t=>t.endsWith(":00")).map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>종료</div>
              <select value={timeTo} onChange={e=>setTimeTo(e.target.value)} style={{width:"100%",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.85rem",outline:"none",fontFamily:C.font}}>
                {TIMES.filter(t=>t.endsWith(":00")||t==="22:00").map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div>
          <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>요일 선택</div>
          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
            {DAYS.map(d=><button key={d} onClick={()=>toggleDay(d)} style={{border:`1.5px solid ${selDays.includes(d)?C.accent:C.border}`,borderRadius:"7px",padding:"4px 10px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.76rem",background:selDays.includes(d)?C.accent:"#fff",color:selDays.includes(d)?"#fff":C.text2}}>{d}</button>)}
          </div>
        </div>
      </div>
      <div style={{overflowX:"auto",marginBottom:"1rem",maxHeight:"360px",overflowY:"auto",borderRadius:"10px",border:`1px solid ${C.border}`}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"400px"}}>
          <thead><tr style={{background:C.card2}}>
            <th style={{padding:"6px 10px",color:C.muted,fontSize:"0.68rem",textAlign:"left",minWidth:"50px",borderBottom:`2px solid ${C.border}`}}>시간</th>
            {showDays.map(d=><th key={d} style={{padding:"6px 10px",color:C.text2,fontSize:"0.74rem",textAlign:"center",borderBottom:`2px solid ${C.border}`,minWidth:"80px",fontWeight:700}}>{d}요일</th>)}
          </tr></thead>
          <tbody>
            {showTimes.map(time=>{
              const isHour=time.endsWith(":00");
              return(<tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`}}>
                <td style={{padding:"3px 10px",color:isHour?C.text2:"transparent",fontSize:"0.66rem",whiteSpace:"nowrap",background:C.card2,fontWeight:600}}>{time}</td>
                {showDays.map(d=>{const here=getSlots(d,time);return(<td key={d} style={{padding:"2px 3px",verticalAlign:"top"}}>
                  {isHour&&here.map(s=>(<div key={s.id} style={{background:s._teacher?s._teacher.color+"15":"#eff6ff",borderLeft:`3px solid ${s._teacher?.color||C.accent}`,borderRadius:"4px",padding:"2px 5px",marginBottom:"2px",fontSize:"0.67rem",color:C.text,fontFamily:C.font}}><span style={{fontWeight:700,color:s._teacher?.color||C.accent}}>{s.name}</span><span style={{color:C.muted,marginLeft:"3px"}}>{s.grade}</span></div>))}
                  {!isHour&&here.map(s=>(<div key={s.id} style={{height:"5px",borderRadius:"2px",background:s._teacher?s._teacher.color+"40":"#bfdbfe",marginBottom:"2px"}}/>))}
                </td>);})}
              </tr>);
            })}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>닫기</Btn>
        <Btn onClick={doPrint}>🖨️ PDF 인쇄 / 저장</Btn>
      </div>
    </div>
  );
}

/* ── CSV ── */
function exportCSV(filename,headers,rows){
  const bom="\uFEFF";const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
  const lines=[headers.map(esc).join(","),...rows.map(r=>r.map(esc).join(","))];
  const blob=new Blob([bom+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename+".csv";a.click();URL.revokeObjectURL(url);
}

/* ── 레포트 미리보기 공통 프린트 함수 ── */
function printHtml(html){
  const w=window.open("","_blank","width=900,height=700");
  w.document.write(html);w.document.close();setTimeout(()=>w.print(),600);
}

/* ── 요약 미리보기 모달 ── */
function SummaryPreview({targets,dates,selYM,onClose}){
  const [y,m]=selYM.split("-");
  const rows=targets.map(s=>{
    const recs=dates.map(d=>s.records?.[d]||{});
    return{name:s.name,grade:s.grade,school:s.school,
      present:recs.filter(r=>r.att==="present").length,
      absent:recs.filter(r=>r.att==="absent").length,
      makeup:recs.filter(r=>r.att==="makeup").length,
      hw:Object.fromEntries(HW_OPTS.map(h=>[h,recs.filter(r=>r.hw===h).length]))
    };
  });
  function doPrint(){
    printHtml(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>요약 레포트</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;padding:20px;background:#fff;font-size:11px;color:#1e293b}
h2{font-size:14px;margin-bottom:3px}p{font-size:10px;color:#94a3b8;margin-bottom:12px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:center;font-size:10px}
th{background:#f8fafc;font-weight:700;color:#475569}.name{text-align:left;font-weight:700}
.present{color:#10b981;font-weight:700}.absent{color:#ef4444;font-weight:700}.makeup{color:#8b5cf6;font-weight:700}
@media print{body{padding:10px}}</style></head><body>
<h2>봄 학원 출결·숙제 요약 — ${y}년 ${m}월</h2>
<p>출력일: ${new Date().toLocaleDateString("ko-KR")}</p>
<table><thead><tr><th>이름</th><th>학년</th><th>학교</th><th class="present">출석</th><th class="absent">결석</th><th class="makeup">보강</th><th>A</th><th>B</th><th>C</th><th>D</th><th>N</th></tr></thead>
<tbody>${rows.map(r=>`<tr><td class="name">${r.name}</td><td>${r.grade}</td><td>${r.school}</td><td class="present">${r.present}</td><td class="absent">${r.absent}</td><td class="makeup">${r.makeup}</td>${HW_OPTS.map(h=>`<td>${r.hw[h]||0}</td>`).join("")}</tr>`).join("")}
</tbody></table></body></html>`);
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",backdropFilter:"blur(3px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.card,borderRadius:"16px",padding:"1.5rem",width:"100%",maxWidth:"760px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <div>
            <h3 style={{margin:0,fontFamily:C.font,fontSize:"1rem",color:C.text}}>📊 요약 미리보기</h3>
            <div style={{fontSize:"0.75rem",color:C.muted,fontFamily:C.font,marginTop:"2px"}}>{y}년 {m}월 · {targets.length}명</div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <Btn sm onClick={doPrint}>🖨️ 인쇄/PDF</Btn>
            <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:"8px",color:C.muted,cursor:"pointer",width:"32px",height:"32px",fontSize:"1.1rem"}}>×</button>
          </div>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{borderCollapse:"collapse",width:"100%",minWidth:"560px",fontSize:"0.8rem",fontFamily:C.font}}>
            <thead>
              <tr style={{background:C.card2}}>
                {["이름","학년","학교","출석","결석","보강","A","B","C","D","N"].map((h,i)=>(
                  <th key={h} style={{padding:"8px 10px",borderBottom:`2px solid ${C.border}`,textAlign:i<3?"left":"center",color:i===3?"#10b981":i===4?"#ef4444":i===5?"#8b5cf6":C.text2,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>(
                <tr key={i} style={{borderBottom:`1px solid ${C.border}`,background:i%2===0?C.card:C.card2}}>
                  <td style={{padding:"8px 10px",fontWeight:700,color:C.text}}>{r.name}</td>
                  <td style={{padding:"8px 10px",color:C.text2}}>{r.grade}</td>
                  <td style={{padding:"8px 10px",color:C.text2}}>{r.school}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#10b981"}}>{r.present}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#ef4444"}}>{r.absent}</td>
                  <td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:"#8b5cf6"}}>{r.makeup}</td>
                  {HW_OPTS.map(h=><td key={h} style={{padding:"8px 10px",textAlign:"center",color:r.hw[h]>0?HW_COLOR[h]:C.muted,fontWeight:r.hw[h]>0?700:400}}>{r.hw[h]||0}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── 상세 미리보기 모달 ── */
function DetailPreview({targets,dates,selYM,onClose}){
  const [y,m]=selYM.split("-");
  const weekDayNames=["일","월","화","수","목","금","토"];
  function doPrint(){
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>상세 레포트</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;padding:15px;background:#fff;font-size:10px;color:#1e293b}
h2{font-size:13px;margin-bottom:2px}p{font-size:9px;color:#94a3b8;margin-bottom:10px}
.student{margin-bottom:14px;break-inside:avoid}
.s-header{display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#f8fafc;border-radius:6px;margin-bottom:6px;border-left:3px solid #3b82f6}
.s-name{font-weight:700;font-size:11px}.s-info{font-size:9px;color:#94a3b8}
.tags{display:flex;gap:4px;flex-wrap:wrap}
.tag{padding:2px 6px;border-radius:10px;font-size:9px;font-weight:600}
.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-top:4px}
.day-header{text-align:center;font-size:8px;font-weight:700;padding:2px;color:#94a3b8}
.day-header.sun{color:#ef4444}.day-header.sat{color:#3b82f6}
.day{border:1px solid #e2e8f0;border-radius:3px;padding:2px;min-height:28px;font-size:8px}
.day.empty{border:none}
.dn{font-size:7px;color:#94a3b8;text-align:right}
.att{width:14px;height:14px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:6px;color:#fff;font-weight:700}
.hw{width:14px;height:14px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-size:7px;color:#fff;font-weight:700}
.indicators{display:flex;gap:2px;flex-wrap:wrap;margin-top:1px}
@media print{body{padding:8px}.student{page-break-inside:avoid}}</style></head><body>
<h2>봄 학원 출결·숙제 상세 — ${y}년 ${m}월</h2>
<p>출력일: ${new Date().toLocaleDateString("ko-KR")}</p>
${targets.map(s=>{
  const recs=dates.map(d=>({date:d,...(s.records?.[d]||{})}));
  const present=recs.filter(r=>r.att==="present").length;
  const absent=recs.filter(r=>r.att==="absent").length;
  const makeup=recs.filter(r=>r.att==="makeup").length;
  const firstDay=new Date(y,m-1,1).getDay();
  const emptyCells=Array(firstDay).fill(null);
  return `<div class="student">
<div class="s-header"><span class="s-name">${s.name} <span class="s-info">${s.grade} · ${s.school}</span></span>
<div class="tags"><span class="tag" style="background:#10b98118;color:#10b981">출석 ${present}</span><span class="tag" style="background:#ef444418;color:#ef4444">결석 ${absent}</span><span class="tag" style="background:#8b5cf618;color:#8b5cf6">보강 ${makeup}</span></div></div>
<div class="calendar">
${["일","월","화","수","목","금","토"].map((d,i)=>`<div class="day-header${i===0?" sun":i===6?" sat":""}">${d}</div>`).join("")}
${emptyCells.map(()=>`<div class="day empty"></div>`).join("")}
${recs.map(({date,att,hw,memo})=>{
  const dn=parseInt(date.slice(8));
  const attColor=att?ATT_COLOR[att]:"";
  const attLabel=att==="present"?"출":att==="absent"?"결":att==="makeup"?"보":"";
  return `<div class="day"><div class="dn">${dn}</div><div class="indicators">${att?`<span class="att" style="background:${attColor}">${attLabel}</span>`:""}</div><div class="indicators">${hw?`<span class="hw" style="background:${HW_COLOR[hw]}">${hw.toUpperCase()}</span>`:""}</div></div>`;
}).join("")}
</div></div>`;
}).join("")}</body></html>`;
    printHtml(html);
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.6)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",backdropFilter:"blur(3px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:C.card,borderRadius:"16px",padding:"1.5rem",width:"100%",maxWidth:"860px",maxHeight:"90vh",overflowY:"auto",border:`1px solid ${C.border}`,boxShadow:"0 20px 60px rgba(0,0,0,.2)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <div>
            <h3 style={{margin:0,fontFamily:C.font,fontSize:"1rem",color:C.text}}>📋 상세 미리보기</h3>
            <div style={{fontSize:"0.75rem",color:C.muted,fontFamily:C.font,marginTop:"2px"}}>{y}년 {m}월 달력 형태 · {targets.length}명</div>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <Btn sm onClick={doPrint}>🖨️ 인쇄/PDF</Btn>
            <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,borderRadius:"8px",color:C.muted,cursor:"pointer",width:"32px",height:"32px",fontSize:"1.1rem"}}>×</button>
          </div>
        </div>
        {/* 학생별 달력 */}
        {targets.map(s=>{
          const recs=dates.map(d=>({date:d,...(s.records?.[d]||{})}));
          const present=recs.filter(r=>r.att==="present").length;
          const absent=recs.filter(r=>r.att==="absent").length;
          const makeup=recs.filter(r=>r.att==="makeup").length;
          const firstDay=new Date(parseInt(y),parseInt(m)-1,1).getDay();
          return(
            <div key={s.id} style={{marginBottom:"1.25rem",background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,overflow:"hidden"}}>
              {/* 헤더 */}
              <div style={{padding:"0.75rem 1rem",background:"#fff",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"6px"}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <div style={{width:"34px",height:"34px",borderRadius:"50%",background:C.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:C.accent,fontSize:"0.9rem"}}>{s.name[0]}</div>
                  <div>
                    <div style={{fontWeight:700,fontSize:"0.95rem",color:C.text,fontFamily:C.font}}>{s.name}</div>
                    <div style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font}}>{s.grade} · {s.school}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  <Tag c="#10b981">출석 {present}</Tag>
                  <Tag c="#ef4444">결석 {absent}</Tag>
                  <Tag c="#8b5cf6">보강 {makeup}</Tag>
                  {HW_OPTS.map(h=>{const cnt=recs.filter(r=>r.hw===h).length;return cnt>0?<Tag key={h} c={HW_COLOR[h]}>{h.toUpperCase()} {cnt}</Tag>:null;})}
                </div>
              </div>
              {/* 달력 */}
              <div style={{padding:"0.75rem 1rem"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"3px",marginBottom:"4px"}}>
                  {weekDayNames.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:"0.68rem",fontWeight:700,fontFamily:C.font,color:i===0?"#ef4444":i===6?"#3b82f6":C.muted,padding:"3px 0"}}>{d}</div>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"3px"}}>
                  {Array(firstDay).fill(null).map((_,i)=><div key={`e${i}`}/>)}
                  {recs.map(({date,att,hw,memo})=>{
                    const dn=parseInt(date.slice(8));
                    const dow=new Date(parseInt(y),parseInt(m)-1,dn).getDay();
                    return(
                      <div key={date} style={{border:`1.5px solid ${att?ATT_COLOR[att]:C.border}`,borderRadius:"6px",padding:"3px 4px",minHeight:"42px",background:att?ATT_COLOR[att]+"08":"#fff",display:"flex",flexDirection:"column",gap:"2px"}}>
                        <div style={{fontSize:"0.6rem",color:dow===0?"#ef4444":dow===6?"#3b82f6":C.muted,fontWeight:600,fontFamily:C.font,textAlign:"right"}}>{dn}</div>
                        {att&&<div style={{width:"18px",height:"18px",borderRadius:"50%",background:ATT_COLOR[att],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.56rem",color:"#fff",fontWeight:700,margin:"0 auto"}}>{att==="present"?"출":att==="absent"?"결":"보"}</div>}
                        {hw&&<div style={{width:"18px",height:"18px",borderRadius:"3px",background:HW_COLOR[hw],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",color:"#fff",fontWeight:700,margin:"0 auto"}}>{hw.toUpperCase()}</div>}
                        {memo&&!hw&&<div style={{width:"6px",height:"6px",borderRadius:"50%",background:"#f59e0b",margin:"0 auto"}}/>}
                      </div>
                    );
                  })}
                </div>
                {/* 범례 */}
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"8px",paddingTop:"8px",borderTop:`1px dashed ${C.border}`}}>
                  {[["출","출석","#10b981"],["결","결석","#ef4444"],["보","보강","#8b5cf6"]].map(([l,n,c])=>(
                    <div key={l} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                      <div style={{width:"14px",height:"14px",borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.5rem",color:"#fff",fontWeight:700}}>{l}</div>
                      <span style={{fontSize:"0.65rem",color:C.muted,fontFamily:C.font}}>{n}</span>
                    </div>
                  ))}
                  {HW_OPTS.map(h=>(
                    <div key={h} style={{display:"flex",alignItems:"center",gap:"4px"}}>
                      <div style={{width:"14px",height:"14px",borderRadius:"3px",background:HW_COLOR[h],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.55rem",color:"#fff",fontWeight:700}}>{h.toUpperCase()}</div>
                      <span style={{fontSize:"0.65rem",color:C.muted,fontFamily:C.font}}>{HW_DESC[h].split("—")[1]?.trim()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── 레포트 ── */
function ReportModal({students,onUpdateRecord}){
  const now=new Date();
  const [selYM,setSelYM]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [selSid,setSelSid]=useState("all");
  const [editCell,setEditCell]=useState(null);
  const [rSearch,setRSearch]=useState("");
  const [showSummaryPreview,setShowSummaryPreview]=useState(false);
  const [showDetailPreview,setShowDetailPreview]=useState(false);
  const dates=useMemo(()=>monthDates(selYM),[selYM]);
  const sorted=useMemo(()=>sortStudents(students),[students]);
  const targets=useMemo(()=>{
    let b=selSid==="all"?sorted:sorted.filter(s=>s.id===selSid);
    if(rSearch.trim()){const q=rSearch.toLowerCase();b=b.filter(s=>s.name?.includes(q)||s.school?.toLowerCase().includes(q)||s.grade?.includes(q));}
    return b;
  },[selSid,sorted,rSearch]);
  function doDetail(){const[y,m]=selYM.split("-");const rows=[];targets.forEach(s=>dates.forEach(date=>{const r=s.records?.[date]||{};if(r.att||r.hw||r.memo)rows.push([s.name,s.grade,s.school,date,ATT_LABEL[r.att]||"",r.hw?.toUpperCase()||"",r.memo||""]);})
  );exportCSV(`출결_숙제_상세_${y}년${m}월`,["이름","학년","학교","날짜","출결","숙제","메모"],rows);}
  function doSummary(){const[y,m]=selYM.split("-");const rows=targets.map(s=>{const recs=dates.map(d=>s.records?.[d]||{});return[s.name,s.grade,s.school,recs.filter(r=>r.att==="present").length,recs.filter(r=>r.att==="absent").length,recs.filter(r=>r.att==="makeup").length,...HW_OPTS.map(h=>recs.filter(r=>r.hw===h).length)];});exportCSV(`출결_숙제_요약_${y}년${m}월`,["이름","학년","학교","출석","결석","보강","A","B","C","D","N"],rows);}
  function CellEditor({student,date,onClose}){
    const rec=student.records?.[date]||{};
    const [att,setAtt]=useState(rec.att||"");const [hw,setHw]=useState(rec.hw||"");const [memo,setMemo]=useState(rec.memo||"");
    async function save(){const nr={...rec};if(att)nr.att=att;else delete nr.att;if(hw)nr.hw=hw;else delete nr.hw;if(memo)nr.memo=memo;else delete nr.memo;await onUpdateRecord(student.id,date,nr);onClose();}
    async function clear(){await onUpdateRecord(student.id,date,{});onClose();}
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",backdropFilter:"blur(2px)"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
        <div style={{background:C.card,borderRadius:"14px",padding:"1.5rem",width:"100%",maxWidth:"340px",border:`1px solid ${C.border}`,boxShadow:"0 20px 50px rgba(0,0,0,.15)"}}>
          <div style={{fontWeight:700,fontSize:"0.95rem",marginBottom:"1rem",fontFamily:C.font,color:C.text}}>✏️ {student.name} — {date}</div>
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>출결</div>
            <div style={{display:"flex",gap:"6px"}}>
              {[["present","✅ 출석"],["absent","❌ 결석"],["makeup","🔄 보강"]].map(([k,l])=>(
                <button key={k} onClick={()=>setAtt(att===k?"":k)} style={{flex:1,border:`2px solid ${att===k?ATT_COLOR[k]:C.border}`,borderRadius:"8px",padding:"7px 4px",background:att===k?ATT_COLOR[k]+"18":"#fff",color:att===k?ATT_COLOR[k]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.78rem"}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>숙제</div>
            <div style={{display:"flex",gap:"5px"}}>
              {HW_OPTS.map(h=><button key={h} onClick={()=>setHw(hw===h?"":h)} style={{flex:1,border:`2px solid ${hw===h?HW_COLOR[h]:C.border}`,borderRadius:"7px",padding:"6px 2px",background:hw===h?HW_COLOR[h]+"18":"#fff",color:hw===h?HW_COLOR[h]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:800,fontSize:"0.88rem"}}>{h.toUpperCase()}</button>)}
            </div>
          </div>
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>메모</div>
            <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={2} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 10px",color:C.text,fontSize:"0.85rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:"6px",justifyContent:"flex-end"}}>
            <Btn sm v="danger" onClick={clear}>🗑️ 삭제</Btn>
            <Btn sm v="ghost" onClick={onClose}>취소</Btn>
            <Btn sm onClick={save}>💾 저장</Btn>
          </div>
        </div>
      </div>
    );
  }
  return(
    <div>
      {editCell&&<CellEditor student={students.find(s=>s.id===editCell.sid)} date={editCell.date} onClose={()=>setEditCell(null)}/>}
      {showSummaryPreview&&<SummaryPreview targets={targets} dates={dates} selYM={selYM} onClose={()=>setShowSummaryPreview(false)}/>}
      {showDetailPreview&&<DetailPreview targets={targets} dates={dates} selYM={selYM} onClose={()=>setShowDetailPreview(false)}/>}
      <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
        <input type="month" value={selYM} onChange={e=>setSelYM(e.target.value)} style={{background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}/>
        <select value={selSid} onChange={e=>{setSelSid(e.target.value);setRSearch("");}} style={{background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
          <option value="all">전체 원생</option>{sorted.map(s=><option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:"6px",flexWrap:"wrap"}}>
          <Btn sm v="ghost" onClick={()=>setShowSummaryPreview(true)}>👁️ 요약 보기</Btn>
          <Btn sm v="ghost" onClick={()=>setShowDetailPreview(true)}>👁️ 상세 보기</Btn>
          <Btn sm v="success" onClick={doSummary}>📊 요약 엑셀</Btn>
          <Btn sm onClick={doDetail}>📥 상세 엑셀</Btn>
        </div>
      </div>
      {selSid==="all"&&<input value={rSearch} onChange={e=>setRSearch(e.target.value)} placeholder="🔍 이름·학교·학년 검색" style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 14px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font,boxSizing:"border-box",marginBottom:"0.75rem"}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>}
      <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"0.75rem",fontFamily:C.font,background:"#fff7ed",padding:"8px 12px",borderRadius:"8px",border:"1px solid #fed7aa"}}>💡 날짜 칸을 클릭하면 출결/숙제를 수정할 수 있어요</div>
      {targets.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"2rem",fontFamily:C.font}}>검색 결과가 없습니다</div>}
      {targets.map(s=>{
        const recs=dates.map(d=>({date:d,...(s.records?.[d]||{})}));
        return(
          <div key={s.id} style={{background:C.card2,borderRadius:"12px",padding:"1rem",marginBottom:"1rem",border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",flexWrap:"wrap",gap:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"50%",background:C.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:C.accent,fontSize:"0.85rem"}}>{s.name[0]}</div>
                <div><span style={{fontWeight:700,fontSize:"0.95rem",fontFamily:C.font,color:C.text}}>{s.name}</span><span style={{color:C.muted,fontSize:"0.76rem",fontFamily:C.font,marginLeft:"6px"}}>{s.grade} · {s.school}</span></div>
              </div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                <Tag c="#10b981">출석 {recs.filter(r=>r.att==="present").length}</Tag>
                <Tag c="#ef4444">결석 {recs.filter(r=>r.att==="absent").length}</Tag>
                <Tag c="#8b5cf6">보강 {recs.filter(r=>r.att==="makeup").length}</Tag>
                {HW_OPTS.map(h=>{const cnt=recs.filter(r=>r.hw===h).length;return cnt>0?<Tag key={h} c={HW_COLOR[h]}>{h.toUpperCase()} {cnt}</Tag>:null;})}
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"3px"}}>
              {recs.map(({date,att,hw,memo})=>(
                <div key={date} onClick={()=>setEditCell({sid:s.id,date})} title={`${date} 클릭하여 수정`}
                  style={{width:"34px",height:"48px",borderRadius:"7px",background:att?ATT_COLOR[att]+"12":"#fff",border:`1.5px solid ${att?ATT_COLOR[att]:C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                  <div style={{fontSize:"0.6rem",color:C.muted,fontFamily:C.font}}>{date.slice(8)}</div>
                  {att&&<div style={{width:"16px",height:"16px",borderRadius:"50%",background:ATT_COLOR[att],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.54rem",color:"#fff",fontWeight:700}}>{att==="present"?"출":att==="absent"?"결":"보"}</div>}
                  {hw&&<div style={{width:"16px",height:"16px",borderRadius:"4px",background:HW_COLOR[hw],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"#fff",fontWeight:700}}>{hw.toUpperCase()}</div>}
                  {memo&&!hw&&<div style={{width:"7px",height:"7px",borderRadius:"50%",background:"#f59e0b"}}/>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 원생 상세 ── */
function StudentDetail({student,teacher,onEdit,onDelete,onUpdateRecord}){
  const td=today();const rec=student.records?.[td]||{};
  const [hw,setHw]=useState(rec.hw||"");const [memo,setMemo]=useState(rec.memo||"");const [saved,setSaved]=useState(false);
  const curAtt=student.records?.[td]?.att;
  function saveRec(att){onUpdateRecord(student.id,td,{...(student.records?.[td]||{}),att,hw:hw||(student.records?.[td]?.hw||""),memo:memo||(student.records?.[td]?.memo||"")});}
  function saveHwMemo(){onUpdateRecord(student.id,td,{...(student.records?.[td]||{}),hw,memo});setSaved(true);setTimeout(()=>setSaved(false),2000);}
  return(
    <div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1.25rem"}}>
        <Btn sm onClick={onEdit}>✏️ 수정</Btn>
        <Btn sm v="danger" style={{marginLeft:"auto"}} onClick={onDelete}>🗑️ 삭제</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
        {[["이름",student.name],["학년",student.grade],["학교",student.school],["과목",student.subject],["기본 담당",teacher?.name||"미배정"]].map(([k,v])=>(
          <div key={k} style={{background:C.card2,borderRadius:"10px",padding:"0.7rem 0.9rem",border:`1px solid ${C.border}`}}>
            <div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"3px",fontFamily:C.font,fontWeight:600}}>{k}</div>
            <div style={{color:C.text,fontWeight:700,fontSize:"0.88rem",fontFamily:C.font}}>{v}</div>
          </div>
        ))}
      </div>
      {student.textbooks&&<div style={{background:C.card2,borderRadius:"10px",padding:"0.7rem 0.9rem",marginBottom:"8px",border:`1px solid ${C.border}`}}><div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"3px",fontFamily:C.font,fontWeight:600}}>교재</div><div style={{color:C.text,fontSize:"0.88rem",fontFamily:C.font}}>{student.textbooks}</div></div>}
      {student.memo&&<div style={{background:C.card2,borderRadius:"10px",padding:"0.7rem 0.9rem",marginBottom:"8px",border:`1px solid ${C.border}`}}><div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"3px",fontFamily:C.font,fontWeight:600}}>메모</div><div style={{color:C.text,fontSize:"0.88rem",fontFamily:C.font}}>{student.memo}</div></div>}
      <div style={{background:curAtt?ATT_COLOR[curAtt]+"08":"#f0f9ff",borderRadius:"12px",padding:"1.1rem",marginBottom:"12px",border:`2px solid ${curAtt?ATT_COLOR[curAtt]:C.border}`}}>
        <div style={{fontWeight:700,fontSize:"0.9rem",marginBottom:"1rem",fontFamily:C.font,display:"flex",alignItems:"center",gap:"8px",color:C.text}}>
          📅 오늘 기록 <span style={{color:C.muted,fontWeight:400,fontSize:"0.78rem"}}>{td}</span>
          {curAtt&&<Tag c={ATT_COLOR[curAtt]}>{ATT_LABEL[curAtt]}</Tag>}
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>출결 상태</div>
          <div style={{display:"flex",gap:"6px"}}>
            {[["present","✅ 출석"],["absent","❌ 결석"],["makeup","🔄 보강"]].map(([k,l])=>(
              <button key={k} onClick={()=>saveRec(k)} style={{flex:1,border:`2px solid ${curAtt===k?ATT_COLOR[k]:C.border}`,borderRadius:"10px",padding:"9px 4px",background:curAtt===k?ATT_COLOR[k]+"18":"#fff",color:curAtt===k?ATT_COLOR[k]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.82rem"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>오늘 숙제</div>
          <div style={{display:"flex",gap:"5px",marginBottom:"4px"}}>
            {HW_OPTS.map(h=><button key={h} onClick={()=>setHw(hw===h?"":h)} style={{flex:1,border:`2px solid ${hw===h?HW_COLOR[h]:C.border}`,borderRadius:"8px",padding:"7px 2px",background:hw===h?HW_COLOR[h]+"18":"#fff",color:hw===h?HW_COLOR[h]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:800,fontSize:"0.9rem"}}>{h.toUpperCase()}</button>)}
          </div>
          {hw&&<div style={{fontSize:"0.74rem",color:HW_COLOR[hw],fontFamily:C.font,fontWeight:600}}>{HW_DESC[hw]}</div>}
        </div>
        <div style={{marginBottom:"0.9rem"}}>
          <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>수업 메모</div>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={2} placeholder="수업 내용, 특이사항..." style={{width:"100%",background:"#fff",border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 10px",color:C.text,fontSize:"0.85rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,resize:"vertical"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <Btn onClick={saveHwMemo}>💾 숙제·메모 저장</Btn>
          {saved&&<span style={{color:"#10b981",fontSize:"0.78rem",fontFamily:C.font,fontWeight:600}}>저장됨 ✓</span>}
        </div>
      </div>
      <div style={{background:C.card2,borderRadius:"12px",padding:"1rem",border:`1px solid ${C.border}`}}>
        <div style={{fontWeight:700,fontSize:"0.88rem",marginBottom:"0.75rem",fontFamily:C.font,color:C.text}}>📋 최근 기록</div>
        <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
          {Object.entries(student.records||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,20).map(([date,r])=>(
            <div key={date} style={{background:r.att?ATT_COLOR[r.att]+"12":"#fff",borderRadius:"8px",padding:"5px 8px",border:`1.5px solid ${r.att?ATT_COLOR[r.att]:C.border}`,minWidth:"50px",textAlign:"center"}}>
              <div style={{fontSize:"0.62rem",color:C.muted,fontFamily:C.font}}>{date.slice(5)}</div>
              <div style={{display:"flex",gap:"3px",justifyContent:"center",marginTop:"2px"}}>
                {r.att&&<span style={{fontSize:"0.64rem",fontWeight:700,color:ATT_COLOR[r.att]}}>{r.att==="present"?"출":r.att==="absent"?"결":"보"}</span>}
                {r.hw&&<span style={{fontSize:"0.64rem",fontWeight:700,color:HW_COLOR[r.hw]}}>{r.hw.toUpperCase()}</span>}
              </div>
            </div>
          ))}
          {Object.keys(student.records||{}).length===0&&<span style={{color:C.muted,fontSize:"0.8rem",fontFamily:C.font}}>기록 없음</span>}
        </div>
      </div>
    </div>
  );
}

/* ── 원생 폼 ── */
function StudentForm({init,teachers,onSave,onClose}){
  const blank={id:`s_${Date.now()}`,name:"",grade:GRADES[0],school:"",subject:SUBJECTS[0],textbooks:"",memo:"",teacherId:null,schedule:[],records:{}};
  const [f,sf]=useState(init||blank);
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  const handleTeacherChange=tid=>{const upd=(f.schedule||[]).map(sc=>!sc.teacherId?{...sc,teacherId:tid||null}:sc);sf(p=>({...p,teacherId:tid||null,schedule:upd}));};
  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <Inp label="이름 *" value={f.name} onChange={e=>s("name",e.target.value)} placeholder="학생 이름"/>
        <Sel label="학년" opts={GRADES} value={f.grade} onChange={e=>s("grade",e.target.value)}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <Inp label="학교" value={f.school} onChange={e=>s("school",e.target.value)}/>
        <Sel label="과목" opts={SUBJECTS} value={f.subject} onChange={e=>s("subject",e.target.value)}/>
      </div>
      <Sel label="기본 담당 선생님" opts={[{v:"",l:"미배정"},...teachers.map(t=>({v:t.id,l:t.name}))]} value={f.teacherId||""} onChange={e=>handleTeacherChange(e.target.value)}/>
      <Inp label="교재" value={f.textbooks} onChange={e=>s("textbooks",e.target.value)} placeholder="교재명 (쉼표 구분)"/>
      <div style={{marginBottom:"0.9rem"}}>
        <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"3px",fontFamily:C.font,fontWeight:600}}>메모</div>
        <textarea value={f.memo} onChange={e=>s("memo",e.target.value)} rows={2} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,resize:"vertical"}}/>
      </div>
      <div style={{marginBottom:"0.9rem"}}>
        <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>시간표</div>
        <StudentScheduleEditor schedule={f.schedule||[]} onChange={v=>s("schedule",v)} teachers={teachers} defaultTeacherId={f.teacherId}/>
      </div>
      <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>취소</Btn>
        <Btn onClick={()=>{if(!f.name.trim())return alert("이름을 입력하세요");onSave(f);onClose();}}>저장</Btn>
      </div>
    </div>
  );
}

/* ── 선생님 폼 ── */
function TeacherForm({init,onSave,onClose}){
  const blank={id:`t_${Date.now()}`,name:"",subject:SUBJECTS[0],color:TCOLORS[4]};
  const [f,sf]=useState(init||blank);
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  return(
    <div>
      <Inp label="이름 *" value={f.name} onChange={e=>s("name",e.target.value)}/>
      <Sel label="담당 과목" opts={SUBJECTS} value={f.subject} onChange={e=>s("subject",e.target.value)}/>
      <div style={{marginBottom:"0.9rem"}}>
        <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>대표 색상</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {TCOLORS.map(c=><div key={c} onClick={()=>s("color",c)} style={{width:"30px",height:"30px",borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"3px solid #1e293b":"3px solid transparent",boxShadow:f.color===c?`0 0 0 2px #fff,0 0 0 4px ${c}`:"none",transition:"all .15s"}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>취소</Btn>
        <Btn onClick={()=>{if(!f.name.trim())return alert("이름을 입력하세요");onSave(f);onClose();}}>저장</Btn>
      </div>
    </div>
  );
}

/* ══ 메인 앱 ══ */
export default function App(){
  const isMobile=useIsMobile();
  const [user,setUser]=useState(undefined);
  const [students,setStudents]=useState([]);
  const [teachers,setTeachers]=useState([]);
  const [tab,setTab]=useState("schedule");
  const [schedView,setSchedView]=useState("full");
  const [tvId,setTvId]=useState(null);
  const [selS,setSelS]=useState(null);
  const [editS,setEditS]=useState(null);
  const [addS,setAddS]=useState(false);
  const [selT,setSelT]=useState(null);
  const [editT,setEditT]=useState(null);
  const [addT,setAddT]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [showPdf,setShowPdf]=useState(false);
  const [schedModal,setSchedModal]=useState(null);
  const [search,setSearch]=useState("");
  const [fT,setFT]=useState("all");
  const [fSub,setFSub]=useState("all");

  useEffect(()=>{return onAuthStateChanged(auth,u=>setUser(u||null));},[]);
  useEffect(()=>{
    if(!user) return;
    const u1=onSnapshot(collection(db,"students"),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,"teachers"),snap=>setTeachers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return()=>{u1();u2();};
  },[user]);

  const saveStudent=async s=>setDoc(doc(db,"students",s.id),s);
  const saveTeacher=async t=>setDoc(doc(db,"teachers",t.id),t);
  const delStudent=async id=>{if(confirm("원생을 삭제할까요?")){await deleteDoc(doc(db,"students",id));setSelS(null);setSchedModal(null);}};
  const delTeacher=async id=>{if(confirm("선생님을 삭제할까요?")){await deleteDoc(doc(db,"teachers",id));for(const s of students.filter(s=>s.teacherId===id))await setDoc(doc(db,"students",s.id),{...s,teacherId:null});setSelT(null);}};
  const updateRecord=async(sid,date,rec)=>{const s=students.find(x=>x.id===sid);if(!s)return;await setDoc(doc(db,"students",sid),{...s,records:{...(s.records||{}),[date]:rec}});};

  const handleStudentClick=s=>setSchedModal(s);
  const sorted=useMemo(()=>sortStudents(students),[students]);
  const filtered=useMemo(()=>{
    const q=search.toLowerCase();
    return sorted.filter(s=>(!q||s.name?.includes(q)||s.school?.toLowerCase().includes(q)||s.grade?.includes(q))&&(fT==="all"||s.teacherId===fT)&&(fSub==="all"||s.subject===fSub));
  },[sorted,search,fT,fSub]);

  const td=today();
  const todayAtts=students.map(s=>s.records?.[td]?.att).filter(Boolean);
  const TABS=[{id:"schedule",l:"📅 시간표"},{id:"students",l:"👨‍🎓 원생"},{id:"teachers",l:"👩‍🏫 선생님"}];
  const schedStudentData=schedModal?students.find(s=>s.id===schedModal.id)||schedModal:null;

  if(user===undefined) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:C.font}}>로딩 중...</div>;
  if(!user) return <LoginScreen/>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.font}}>
      {/* 헤더 */}
      <header style={{background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        {isMobile?(
          <div>
            <div style={{padding:"0 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:"48px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem"}}>📐</div>
                <span style={{fontWeight:800,fontSize:"0.9rem",color:C.text}}>봄 학원 관리</span>
              </div>
              <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                <Btn sm v="ghost" onClick={()=>setShowPdf(true)}>🖨️</Btn>
                <Btn sm v="purple" onClick={()=>setShowReport(true)}>📊</Btn>
                <button onClick={()=>signOut(auth)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.75rem",fontFamily:C.font}}>로그아웃</button>
              </div>
            </div>
            <div style={{display:"flex",borderTop:`1px solid ${C.border}`}}>
              {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,border:"none",padding:"9px 4px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.78rem",background:tab===t.id?"#eff6ff":C.card,color:tab===t.id?C.accent:C.text2,borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent"}}>{t.l}</button>)}
            </div>
          </div>
        ):(
          <div style={{maxWidth:"1300px",margin:"0 auto",padding:"0 1.25rem",display:"flex",alignItems:"center",height:"56px",gap:"1.25rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
              <div style={{width:"32px",height:"32px",borderRadius:"9px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>📐</div>
              <span style={{fontWeight:800,fontSize:"1rem",letterSpacing:"-0.02em",color:C.text}}>봄 학원 관리</span>
            </div>
            <nav style={{display:"flex",gap:"4px"}}>
              {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{border:"none",borderRadius:"8px",padding:"6px 16px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.83rem",background:tab===t.id?"#eff6ff":C.bg,color:tab===t.id?C.accent:C.text2,transition:"all .15s",boxShadow:tab===t.id?"inset 0 0 0 1.5px #bfdbfe":"none"}}>{t.l}</button>)}
            </nav>
            <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
              <Btn sm v="ghost" onClick={()=>setShowPdf(true)}>🖨️ 시간표 PDF</Btn>
              <Btn sm v="purple" onClick={()=>setShowReport(true)}>📊 레포트</Btn>
              <span style={{fontSize:"0.72rem",color:C.muted}}>{user.email}</span>
              <button onClick={()=>signOut(auth)} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"4px 12px",color:C.text2,cursor:"pointer",fontSize:"0.72rem",fontFamily:C.font}}>로그아웃</button>
            </div>
          </div>
        )}
      </header>

      <main style={{maxWidth:"1300px",margin:"0 auto",padding:isMobile?"0.75rem":"1.25rem"}}>
        {/* 통계 */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:isMobile?"8px":"12px",marginBottom:"1rem"}}>
          {[{l:"전체 원생",v:`${students.length}명`,icon:"👨‍🎓",c:"#3b82f6",bg:"#eff6ff"},{l:"선생님",v:`${teachers.length}명`,icon:"👩‍🏫",c:"#8b5cf6",bg:"#f5f3ff"},{l:"오늘 출석",v:`${todayAtts.filter(a=>a==="present").length}명`,icon:"✅",c:"#10b981",bg:"#f0fdf4"},{l:"오늘 결석",v:`${todayAtts.filter(a=>a==="absent").length}명`,icon:"❌",c:"#ef4444",bg:"#fef2f2"}].map(({l,v,icon,c,bg})=>(
            <div key={l} style={{background:C.card,borderRadius:"12px",padding:isMobile?"0.65rem 0.8rem":"1rem 1.1rem",border:`1px solid ${C.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"3px",fontWeight:600}}>{l}</div><div style={{fontWeight:800,fontSize:isMobile?"0.9rem":"1.1rem",color:c}}>{v}</div></div>
                <div style={{width:isMobile?"26px":"36px",height:isMobile?"26px":"36px",borderRadius:"8px",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?"0.8rem":"1.1rem"}}>{icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 시간표 탭 */}
        {tab==="schedule"&&(
          <div style={{background:C.card,borderRadius:"14px",border:`1px solid ${C.border}`}}>
            <div style={{padding:isMobile?"0.75rem 1rem":"1rem 1.25rem",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"8px",flexWrap:"wrap"}}>
              <h2 style={{margin:0,fontSize:"0.9rem",fontWeight:700,color:C.text}}>📅 시간표</h2>
              <div style={{display:"flex",gap:"4px",background:C.bg,borderRadius:"10px",padding:"3px"}}>
                {[{id:"full",l:"전체"},{id:"byTeacher",l:"선생님별"}].map(sv=>(
                  <button key={sv.id} onClick={()=>setSchedView(sv.id)} style={{border:"none",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.76rem",background:schedView===sv.id?C.card:"transparent",color:schedView===sv.id?C.accent:C.muted,boxShadow:schedView===sv.id?"0 1px 3px rgba(0,0,0,.08)":"none"}}>{sv.l}</button>
                ))}
              </div>
            </div>
            <div style={{padding:isMobile?"0.75rem 1rem":"1rem 1.25rem"}}>
              {schedView==="full"&&(isMobile
                ?<MobileSched teachers={teachers} students={students} onStudentClick={handleStudentClick}/>
                :<FullSched teachers={teachers} students={students} onStudentClick={handleStudentClick}/>
              )}
              {schedView==="byTeacher"&&(
                <div>
                  <div style={{display:"flex",gap:"6px",marginBottom:"1rem",flexWrap:"wrap",overflowX:isMobile?"auto":"visible"}}>
                    {teachers.map(t=><button key={t.id} onClick={()=>setTvId(t.id)} style={{flexShrink:0,border:`2px solid ${tvId===t.id?t.color:C.border}`,borderRadius:"9px",padding:"5px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.8rem",background:tvId===t.id?t.color+"15":"#fff",color:tvId===t.id?t.color:C.text2}}>{t.name}</button>)}
                  </div>
                  {tvId?(isMobile
                    ?<MobileTeacherSched teacher={teachers.find(x=>x.id===tvId)} students={students} onStudentClick={handleStudentClick}/>
                    :<TeacherSched teacher={teachers.find(x=>x.id===tvId)} students={students} onStudentClick={handleStudentClick}/>
                  ):<div style={{color:C.muted,textAlign:"center",padding:"3rem",fontFamily:C.font}}>선생님을 선택하세요</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 원생 탭 */}
        {tab==="students"&&(
          <div>
            <div style={{display:"flex",gap:"8px",marginBottom:"0.75rem",flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 이름·학교·학년 검색"
                style={{flex:1,minWidth:"0",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"10px",padding:"8px 14px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font,boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              <Btn onClick={()=>setAddS(true)}>+ 원생 추가</Btn>
            </div>
            <div style={{display:"flex",gap:"6px",marginBottom:"1rem"}}>
              <select value={fT} onChange={e=>setFT(e.target.value)} style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.82rem",outline:"none",fontFamily:C.font}}>
                <option value="all">전체 선생님</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={fSub} onChange={e=>setFSub(e.target.value)} style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.82rem",outline:"none",fontFamily:C.font}}>
                <option value="all">전체 과목</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {isMobile?(
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {filtered.map(st=>{
                  const teacher=teachers.find(t=>t.id===st.teacherId);const tr=st.records?.[td]||{};
                  return(
                    <div key={st.id} onClick={()=>setSelS(st)} style={{background:C.card,borderRadius:"12px",padding:"0.85rem 1rem",border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",left:0,top:0,bottom:0,width:"4px",background:teacher?.color||C.accent,borderRadius:"12px 0 0 12px"}}/>
                      <div style={{width:"40px",height:"40px",borderRadius:"50%",background:(teacher?.color||C.accent)+"18",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:teacher?.color||C.accent,fontSize:"1rem",flexShrink:0}}>{st.name[0]}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontWeight:700,fontSize:"0.95rem",color:C.text}}>{st.name}</span>
                          {tr.att&&<Tag c={ATT_COLOR[tr.att]}>{ATT_LABEL[tr.att]}</Tag>}
                        </div>
                        <div style={{color:C.muted,fontSize:"0.74rem",marginTop:"2px"}}>{st.grade} · {st.school}</div>
                        <div style={{display:"flex",gap:"4px",marginTop:"4px",flexWrap:"wrap"}}>
                          <Tag c={teacher?.color||C.accent}>{st.subject}</Tag>
                          {tr.hw&&<Tag c={HW_COLOR[tr.hw]}>숙제 {tr.hw.toUpperCase()}</Tag>}
                        </div>
                      </div>
                      <span style={{color:C.muted,fontSize:"1.2rem",flexShrink:0}}>›</span>
                    </div>
                  );
                })}
                {filtered.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"3rem",fontFamily:C.font}}>원생이 없습니다</div>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px"}}>
                {filtered.map(st=>{
                  const teacher=teachers.find(t=>t.id===st.teacherId);const tr=st.records?.[td]||{};
                  return(
                    <div key={st.id} onClick={()=>setSelS(st)} style={{background:C.card,borderRadius:"13px",padding:"1.1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .2s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=teacher?.color||C.accent;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,.1)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none";}}>
                      <div style={{position:"absolute",top:0,left:0,right:0,height:"4px",background:teacher?.color||C.accent,borderRadius:"13px 13px 0 0"}}/>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
                        <div><div style={{fontWeight:700,fontSize:"0.95rem",color:C.text}}>{st.name}</div><div style={{color:C.muted,fontSize:"0.72rem"}}>{st.grade} · {st.school}</div></div>
                        {tr.att&&<Tag c={ATT_COLOR[tr.att]}>{ATT_LABEL[tr.att]}</Tag>}
                      </div>
                      <div style={{marginBottom:"6px",display:"flex",gap:"4px",flexWrap:"wrap"}}>
                        <Tag c={teacher?.color||C.accent}>{st.subject}</Tag>
                        {tr.hw&&<Tag c={HW_COLOR[tr.hw]}>숙제 {tr.hw.toUpperCase()}</Tag>}
                      </div>
                      <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                        {(st.schedule||[]).slice(0,4).map((sc,i)=><span key={i} style={{fontSize:"0.64rem",padding:"2px 6px",borderRadius:"5px",background:C.bg,color:C.text2,fontFamily:C.font,border:`1px solid ${C.border}`}}>{sc.day} {sc.time}</span>)}
                        {(st.schedule||[]).length>4&&<span style={{fontSize:"0.64rem",color:C.muted}}>+{st.schedule.length-4}</span>}
                      </div>
                      {teacher&&<div style={{marginTop:"6px",fontSize:"0.68rem",color:teacher.color,fontWeight:600}}>👩‍🏫 {teacher.name}</div>}
                    </div>
                  );
                })}
                {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",color:C.muted,padding:"3rem",fontFamily:C.font}}>원생이 없습니다</div>}
              </div>
            )}
          </div>
        )}

        {/* 선생님 탭 */}
        {tab==="teachers"&&(
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"1rem"}}><Btn onClick={()=>setAddT(true)}>+ 선생님 추가</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
              {teachers.map(t=>{
                const mine=[...new Map(students.filter(s=>s.schedule?.some(sc=>(sc.teacherId||s.teacherId)===t.id)).map(s=>[s.id,s])).values()];
                return(
                  <div key={t.id} onClick={()=>setSelT(t)} style={{background:C.card,borderRadius:"13px",padding:"1.1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=t.color;e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,.1)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="none";}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"4px",background:t.color,borderRadius:"13px 13px 0 0"}}/>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                      <div style={{width:"40px",height:"40px",borderRadius:"50%",background:t.color+"20",border:`2px solid ${t.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:t.color,fontSize:"1.05rem",flexShrink:0}}>{t.name[0]}</div>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:"0.95rem",color:C.text}}>{t.name}</div><div style={{color:C.muted,fontSize:"0.72rem"}}>{t.subject}</div></div>
                      <div style={{fontWeight:800,fontSize:"1rem",color:t.color}}>{mine.length}명</div>
                    </div>
                    <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                      {mine.map(s=><Tag key={s.id} c={t.color}>{s.name}</Tag>)}
                      {mine.length===0&&<span style={{fontSize:"0.74rem",color:C.muted,fontFamily:C.font}}>담당 원생 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 모달 */}
      {selS&&!editS&&(<Modal title={`${selS.name} 원생 상세`} onClose={()=>setSelS(null)} wide zIndex={200}><StudentDetail student={students.find(s=>s.id===selS.id)||selS} teacher={teachers.find(t=>t.id===selS.teacherId)} onEdit={()=>setEditS(students.find(s=>s.id===selS.id))} onDelete={()=>delStudent(selS.id)} onUpdateRecord={updateRecord}/></Modal>)}
      {editS&&(<Modal title="원생 정보 수정" onClose={()=>setEditS(null)} wide zIndex={210}><StudentForm init={editS} teachers={teachers} onSave={saveStudent} onClose={()=>{setEditS(null);setSelS(null);}}/></Modal>)}
      {addS&&(<Modal title="원생 추가" onClose={()=>setAddS(false)} wide zIndex={200}><StudentForm teachers={teachers} onSave={saveStudent} onClose={()=>setAddS(false)}/></Modal>)}
      {selT&&!editT&&(<Modal title={`${selT.name} 시간표`} onClose={()=>setSelT(null)} wide zIndex={200}>
        <div style={{display:"flex",gap:"6px",marginBottom:"1rem"}}>
          <Btn sm onClick={()=>setEditT(selT)}>✏️ 정보 수정</Btn>
          <Btn sm v="danger" onClick={()=>delTeacher(selT.id)}>🗑️ 삭제</Btn>
        </div>
        {isMobile
          ?<MobileTeacherSched teacher={selT} students={students} onStudentClick={handleStudentClick}/>
          :<TeacherSched teacher={selT} students={students} onStudentClick={handleStudentClick}/>
        }
      </Modal>)}
      {editT&&(<Modal title="선생님 정보 수정" onClose={()=>setEditT(null)} zIndex={210}><TeacherForm init={editT} onSave={saveTeacher} onClose={()=>{setEditT(null);setSelT(null);}}/></Modal>)}
      {addT&&(<Modal title="선생님 추가" onClose={()=>setAddT(false)} zIndex={200}><TeacherForm onSave={saveTeacher} onClose={()=>setAddT(false)}/></Modal>)}
      {schedStudentData&&(<Modal title={`${schedStudentData.name} 원생 상세`} onClose={()=>setSchedModal(null)} wide zIndex={300}><StudentDetail student={schedStudentData} teacher={teachers.find(t=>t.id===schedStudentData.teacherId)} onEdit={()=>{setEditS(schedStudentData);setSchedModal(null);}} onDelete={()=>delStudent(schedStudentData.id)} onUpdateRecord={updateRecord}/></Modal>)}
      {showReport&&(<Modal title="📊 월별 출결·숙제 레포트" onClose={()=>setShowReport(false)} wide zIndex={200}><ReportModal students={students} onUpdateRecord={updateRecord}/></Modal>)}
      {showPdf&&(<Modal title="🖨️ 시간표 PDF 출력" onClose={()=>setShowPdf(false)} wide zIndex={200}><PdfModal teachers={teachers} students={students} onClose={()=>setShowPdf(false)}/></Modal>)}
    </div>
  );
}
