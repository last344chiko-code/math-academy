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

/* ── 상수 ── */
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

/* ── 학년+이름 정렬 함수 ── */
const sortStudents = (arr) => [...arr].sort((a,b) => {
  const gd = (GRADE_ORDER[a.grade]??99) - (GRADE_ORDER[b.grade]??99);
  if(gd!==0) return gd;
  return (a.name||"").localeCompare(b.name||"","ko");
});

/* ── 라이트 테마 ── */
const C = {
  bg:"#f1f5f9", card:"#ffffff", card2:"#f8fafc",
  border:"#e2e8f0", border2:"#cbd5e1",
  text:"#1e293b", text2:"#475569", muted:"#94a3b8",
  accent:"#3b82f6", font:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"
};

/* ── 공통 컴포넌트 ── */
const Tag = ({c="#3b82f6",children}) => (
  <span style={{fontSize:"0.68rem",padding:"2px 8px",borderRadius:"20px",background:c+"18",color:c,fontFamily:C.font,fontWeight:600,whiteSpace:"nowrap",border:`1px solid ${c}30`}}>{children}</span>
);

const Btn = ({children,v="primary",sm,style:xs,...p}) => {
  const m={primary:{bg:"#3b82f6",fg:"#fff",hv:"#2563eb"},ghost:{bg:"#f1f5f9",fg:C.text2,hv:"#e2e8f0"},danger:{bg:"#ef4444",fg:"#fff",hv:"#dc2626"},success:{bg:"#10b981",fg:"#fff",hv:"#059669"},purple:{bg:"#8b5cf6",fg:"#fff",hv:"#7c3aed"}};
  const st=m[v]||m.primary;
  return <button {...p} style={{border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:C.font,fontWeight:600,padding:sm?"4px 12px":"8px 18px",fontSize:sm?"0.74rem":"0.85rem",background:st.bg,color:st.fg,transition:"all .15s",...xs}}
    onMouseEnter={e=>e.currentTarget.style.background=st.hv}
    onMouseLeave={e=>e.currentTarget.style.background=st.bg}
  >{children}</button>;
};

const Inp = ({label,...p}) => (
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>{label}</div>}
    <input {...p} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,transition:"border-color .15s",...p.style}}
      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
  </div>
);

const Sel = ({label,opts,...p}) => (
  <div style={{marginBottom:"0.9rem"}}>
    {label&&<div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"4px",fontFamily:C.font,fontWeight:600}}>{label}</div>}
    <select {...p} style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font}}>
      {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  </div>
);

/* ── Modal: zIndex prop 지원 ── */
const Modal = ({title,onClose,wide,zIndex=200,children}) => (
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
function LoginScreen() {
  const [email,setEmail]=useState(""); const [pw,setPw]=useState(""); const [err,setErr]=useState(""); const [loading,setLoad]=useState(false);
  async function handleLogin(){if(!email||!pw)return setErr("이메일과 비밀번호를 입력하세요");setLoad(true);setErr("");try{await signInWithEmailAndPassword(auth,email,pw);}catch(e){setErr("이메일 또는 비밀번호가 올바르지 않습니다");}setLoad(false);}
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#eff6ff 0%,#f0fdf4 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.font}}>
      <div style={{background:C.card,borderRadius:"20px",padding:"2.5rem 2rem",width:"100%",maxWidth:"380px",boxShadow:"0 20px 60px rgba(0,0,0,.1)",border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"14px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.6rem",margin:"0 auto 1rem",boxShadow:"0 8px 20px rgba(59,130,246,.3)"}}>📐</div>
          <div style={{fontWeight:800,fontSize:"1.4rem",color:C.text}}>봄 학원 관리</div>
          <div style={{color:C.muted,fontSize:"0.82rem",marginTop:"4px"}}>Bom Schedule</div>
        </div>
        <Inp label="이메일" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@academy.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        <Inp label="비밀번호" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호 입력" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        {err&&<div style={{color:"#ef4444",fontSize:"0.78rem",marginBottom:"0.85rem",background:"#fef2f2",padding:"8px 12px",borderRadius:"8px",border:"1px solid #fecaca"}}>{err}</div>}
        <Btn style={{width:"100%",padding:"11px"}} onClick={handleLogin} disabled={loading}>{loading?"로그인 중...":"로그인"}</Btn>
        <div style={{marginTop:"1.5rem",padding:"1rem",background:C.card2,borderRadius:"10px",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:"0.72rem",color:C.text2,marginBottom:"4px",fontWeight:600}}>👑 계정 관리</div>
          <div style={{fontSize:"0.72rem",color:C.muted,lineHeight:1.7}}>Firebase 콘솔 → Authentication → 사용자 추가</div>
        </div>
      </div>
    </div>
  );
}

/* ── 학생 시간표 편집 ── */
function StudentScheduleEditor({schedule, onChange, teachers, defaultTeacherId}) {
  const getSlot=(d,t)=>schedule.find(s=>s.day===d&&s.time===t);
  const on=(d,t)=>!!getSlot(d,t);
  const tgl=(d,t)=>{if(on(d,t))onChange(schedule.filter(s=>!(s.day===d&&s.time===t)));else onChange([...schedule,{day:d,time:t,teacherId:defaultTeacherId||null}]);};
  const chT=(d,t,tid)=>onChange(schedule.map(s=>(s.day===d&&s.time===t)?{...s,teacherId:tid||null}:s));
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:"420px"}}>
        <thead><tr><th style={{padding:"4px 6px",color:C.muted,fontSize:"0.66rem",textAlign:"left",width:"52px"}}></th>{DAYS.map(d=><th key={d} style={{padding:"4px 5px",color:C.text2,fontSize:"0.74rem",textAlign:"center",minWidth:"56px",fontWeight:600}}>{d}</th>)}</tr></thead>
        <tbody>
          {TIMES.map(t=>{
            const isHour=t.endsWith(":00");
            return (
              <tr key={t} style={{borderTop:isHour?`1px solid ${C.border}`:`1px dashed ${C.border}`}}>
                <td style={{padding:"1px 6px",color:isHour?C.text2:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none"}}>{t}</td>
                {DAYS.map(d=>{
                  const slot=getSlot(d,t);const active=!!slot;
                  const teacher=active&&slot.teacherId?teachers?.find(tc=>tc.id===slot.teacherId):null;
                  return (
                    <td key={d} style={{padding:"1px 2px",verticalAlign:"top"}}>
                      <div onClick={()=>tgl(d,t)} style={{width:"100%",height:"22px",borderRadius:isHour?"3px 3px 0 0":"0 0 3px 3px",background:active?(teacher?.color+"22"||"#dbeafe"):"#f8fafc",border:`1.5px solid ${active?(teacher?.color||C.accent):C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .1s"}}>
                        {active&&isHour&&<span style={{color:teacher?.color||C.accent,fontSize:"0.5rem",fontWeight:700,padding:"0 1px",overflow:"hidden",whiteSpace:"nowrap"}}>{teacher?teacher.name.slice(0,2):"●"}</span>}
                      </div>
                      {active&&(<select value={slot.teacherId||""} onChange={e=>chT(d,t,e.target.value)} onClick={e=>e.stopPropagation()} style={{width:"100%",background:C.card2,border:`1px solid ${teacher?.color||C.border}`,borderRadius:"3px",color:C.text,fontSize:"0.6rem",padding:"1px",marginTop:"1px",fontFamily:C.font}}>
                        <option value="">미배정</option>{teachers?.map(tc=><option key={tc.id} value={tc.id}>{tc.name}</option>)}
                      </select>)}
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

/* ── 모바일 감지 훅 ── */
function useIsMobile(){
  const [mob,setMob]=useState(()=>window.innerWidth<768);
  useEffect(()=>{const h=()=>setMob(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return mob;
}

/* ── 슬롯 카드 (공통) ── */
function SlotCard({s,onStudentClick}){
  return(
    <div onClick={()=>onStudentClick(s)}
      style={{background:s._teacher?s._teacher.color+"15":"#eff6ff",borderLeft:`3px solid ${s._teacher?.color||C.accent}`,borderRadius:"6px",padding:"4px 8px",marginBottom:"4px",fontSize:"0.78rem",color:C.text,fontFamily:C.font,lineHeight:1.5,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}
      onMouseEnter={e=>e.currentTarget.style.opacity=".8"}
      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
      <span style={{fontWeight:700,color:s._teacher?.color||C.accent}}>{s.name}</span>
      <span style={{color:C.muted,marginLeft:"5px",fontSize:"0.7rem"}}>{s.grade}</span>
      {s._teacher&&<div style={{color:s._teacher.color,fontSize:"0.68rem"}}>{s._teacher.name}</div>}
    </div>
  );
}

/* ── 모바일: 하루씩 보기 ── */
function MobileDaySched({teachers,students,onStudentClick}){
  const [selDay,setSelDay]=useState(DAYS[0]);
  const getTeacher=(s,time)=>{const sc=s.schedule?.find(sc=>sc.day===selDay&&sc.time===time);return teachers.find(t=>t.id===(sc?.teacherId||s.teacherId));};

  const slots=useMemo(()=>{
    const result=[];
    TIMES.forEach(time=>{
      const isHour=time.endsWith(":00");
      const here=students.filter(s=>s.schedule?.some(sc=>sc.day===selDay&&sc.time===time))
        .map(s=>({...s,_teacher:getTeacher(s,time)}));
      if(isHour&&here.length>0) result.push({time,isHour:true,students:here});
      else if(!isHour&&here.length>0) result.push({time,isHour:false,students:here});
      else if(isHour) result.push({time,isHour:true,students:[]});
    });
    return result;
  },[selDay,students,teachers]);

  // 수업 있는 시간만 추려서 보여줌
  const activeTimes=useMemo(()=>{
    const hours=new Set();
    students.forEach(s=>s.schedule?.forEach(sc=>{if(sc.day===selDay)hours.add(sc.time.split(":")[0]);}) );
    return TIMES.filter(t=>{
      const h=t.split(":")[0];
      return hours.has(h);
    });
  },[selDay,students]);

  return(
    <div>
      {/* 요일 탭 */}
      <div style={{display:"flex",gap:"4px",marginBottom:"1rem",overflowX:"auto",paddingBottom:"4px"}}>
        {DAYS.map(d=>{
          const hasSched=students.some(s=>s.schedule?.some(sc=>sc.day===d));
          return(
            <button key={d} onClick={()=>setSelDay(d)} style={{
              flexShrink:0,border:`2px solid ${selDay===d?C.accent:C.border}`,borderRadius:"10px",
              padding:"6px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.82rem",
              background:selDay===d?C.accent:"#fff",color:selDay===d?"#fff":hasSched?C.text2:C.muted,
              transition:"all .15s",position:"relative"
            }}>
              {d}
              {hasSched&&selDay!==d&&<span style={{position:"absolute",top:"3px",right:"3px",width:"6px",height:"6px",borderRadius:"50%",background:C.accent}}/>}
            </button>
          );
        })}
      </div>

      {/* 선택한 요일의 시간표 */}
      {activeTimes.length===0?(
        <div style={{textAlign:"center",padding:"2.5rem",color:C.muted,fontFamily:C.font,background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`}}>
          {selDay}요일 수업 없음
        </div>
      ):(
        <div>
          {TIMES.filter(t=>t.endsWith(":00")).map(hourTime=>{
            const h=hourTime.split(":")[0];
            const s00=students.filter(s=>s.schedule?.some(sc=>sc.day===selDay&&sc.time===hourTime)).map(s=>({...s,_teacher:getTeacher(s,hourTime)}));
            const s30=students.filter(s=>s.schedule?.some(sc=>sc.day===selDay&&sc.time===`${h}:30`)).map(s=>({...s,_teacher:getTeacher(s,`${h}:30`)}));
            if(s00.length===0&&s30.length===0) return null;
            return(
              <div key={hourTime} style={{marginBottom:"10px",background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,overflow:"hidden"}}>
                <div style={{background:C.accent+"12",padding:"6px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",gap:"8px",alignItems:"center"}}>
                  <span style={{fontWeight:700,fontSize:"0.85rem",color:C.accent,fontFamily:C.font,minWidth:"42px"}}>{hourTime}</span>
                  {s00.length>0&&<span style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font}}>{s00.map(s=>s.name).join(", ")}</span>}
                </div>
                <div style={{padding:"8px 12px"}}>
                  {s00.length>0&&s00.map(s=><SlotCard key={s.id} s={s} onStudentClick={onStudentClick}/>)}
                  {s30.length>0&&(
                    <div style={{marginTop:s00.length>0?"6px":0}}>
                      <div style={{fontSize:"0.7rem",color:C.muted,fontFamily:C.font,marginBottom:"4px",fontWeight:600}}>{h}:30</div>
                      {s30.map(s=><SlotCard key={s.id} s={s} onStudentClick={onStudentClick}/>)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 전체 시간표 (PC/모바일 자동 전환) ── */
function FullSched({teachers, students, onStudentClick}) {
  const isMobile=useIsMobile();
  const [filterDays,setFilterDays]=useState([...DAYS]);
  const showDays=DAYS.filter(d=>filterDays.includes(d));
  const toggleDay=d=>setFilterDays(p=>p.includes(d)?p.filter(x=>x!==d):[...p,d]);
  const getTeacher=(s,day,time)=>{const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);return teachers.find(t=>t.id===(sc?.teacherId||s.teacherId));};

  // 모바일은 요일탭 방식
  if(isMobile) return <MobileDaySched teachers={teachers} students={students} onStudentClick={onStudentClick}/>;

  // PC는 기존 전체 테이블
  return (
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
              return (
                <tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`,background:C.card}}>
                  <td style={{padding:"3px 10px",color:isHour?C.text2:"transparent",fontSize:"0.68rem",whiteSpace:"nowrap",background:C.card2,userSelect:"none",fontWeight:isHour?600:400}}>{time}</td>
                  {showDays.map(d=>(
                    <td key={d} style={{padding:"2px 4px",verticalAlign:"top",minWidth:"88px"}}>
                      {isHour&&byday[d].map(s=>(
                        <div key={s.id} onClick={()=>onStudentClick(s)} title={`${s.name} 상세 보기`}
                          style={{background:s._teacher?s._teacher.color+"15":"#eff6ff",borderLeft:`3px solid ${s._teacher?.color||C.accent}`,borderRadius:"6px",padding:"3px 7px",marginBottom:"3px",fontSize:"0.72rem",color:C.text,fontFamily:C.font,lineHeight:1.5,cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 3px rgba(0,0,0,.06)"}}
                          onMouseEnter={e=>{e.currentTarget.style.background=s._teacher?s._teacher.color+"28":"#dbeafe";e.currentTarget.style.transform="translateX(2px)";}}
                          onMouseLeave={e=>{e.currentTarget.style.background=s._teacher?s._teacher.color+"15":"#eff6ff";e.currentTarget.style.transform="none";}}>
                          <span style={{fontWeight:700,color:s._teacher?.color||C.accent}}>{s.name}</span>
                          <span style={{color:C.muted,marginLeft:"4px",fontSize:"0.64rem"}}>{s.grade}</span>
                          {s._teacher&&<div style={{color:s._teacher.color,fontSize:"0.62rem",opacity:0.8}}>{s._teacher.name}</div>}
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

/* ── 선생님별 시간표 (PC/모바일 자동 전환) ── */
function TeacherSched({teacher, students, onStudentClick}) {
  const isMobile=useIsMobile();
  const [selDay,setSelDay]=useState(DAYS[0]);

  const getStudentsForSlot=(day,time)=>students.filter(s=>{
    const sc=s.schedule?.find(sc=>sc.day===day&&sc.time===time);
    if(!sc) return false;
    return (sc.teacherId||s.teacherId)===teacher.id;
  });
  const myStudents=[...new Map(students.filter(s=>s.schedule?.some(sc=>(sc.teacherId||s.teacherId)===teacher.id)).map(s=>[s.id,s])).values()];

  // 담당 학생 태그
  const studentTags=(
    <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1rem"}}>
      {myStudents.map(s=>(
        <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderRadius:"8px",padding:"5px 12px",cursor:"pointer",border:`1px solid ${teacher.color}30`,transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.background=teacher.color+"28"} onMouseLeave={e=>e.currentTarget.style.background=teacher.color+"15"}>
          <span style={{color:teacher.color,fontWeight:700,fontSize:"0.8rem",fontFamily:C.font}}>{s.name}</span>
          <span style={{color:C.muted,fontSize:"0.7rem",marginLeft:"5px",fontFamily:C.font}}>{s.grade}</span>
        </div>
      ))}
      {myStudents.length===0&&<span style={{color:C.muted,fontSize:"0.8rem",fontFamily:C.font}}>담당 원생 없음</span>}
    </div>
  );

  // 모바일: 요일탭
  if(isMobile) return(
    <div>
      {studentTags}
      <div style={{display:"flex",gap:"4px",marginBottom:"1rem",overflowX:"auto",paddingBottom:"4px"}}>
        {DAYS.map(d=>{
          const hasSched=myStudents.some(s=>s.schedule?.some(sc=>sc.day===d));
          return(
            <button key={d} onClick={()=>setSelDay(d)} style={{
              flexShrink:0,border:`2px solid ${selDay===d?teacher.color:C.border}`,borderRadius:"10px",
              padding:"6px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.82rem",
              background:selDay===d?teacher.color+"22":"#fff",color:selDay===d?teacher.color:hasSched?C.text2:C.muted,
              transition:"all .15s"
            }}>{d}</button>
          );
        })}
      </div>
      {TIMES.filter(t=>t.endsWith(":00")).map(hourTime=>{
        const h=hourTime.split(":")[0];
        const s00=getStudentsForSlot(selDay,hourTime);
        const s30=getStudentsForSlot(selDay,`${h}:30`);
        if(s00.length===0&&s30.length===0) return null;
        return(
          <div key={hourTime} style={{marginBottom:"10px",background:C.card2,borderRadius:"12px",border:`1px solid ${C.border}`,overflow:"hidden"}}>
            <div style={{background:teacher.color+"12",padding:"6px 12px",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontWeight:700,fontSize:"0.85rem",color:teacher.color,fontFamily:C.font}}>{hourTime}</span>
            </div>
            <div style={{padding:"8px 12px"}}>
              {s00.map(s=>(
                <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"6px",padding:"6px 10px",marginBottom:"4px",cursor:"pointer",transition:"all .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                  <span style={{fontWeight:700,color:teacher.color,fontFamily:C.font}}>{s.name}</span>
                  <span style={{color:C.muted,fontSize:"0.75rem",marginLeft:"6px",fontFamily:C.font}}>{s.grade}</span>
                </div>
              ))}
              {s30.length>0&&(
                <div style={{marginTop:s00.length>0?"6px":0}}>
                  <div style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font,marginBottom:"4px",fontWeight:600}}>{h}:30</div>
                  {s30.map(s=>(
                    <div key={s.id} onClick={()=>onStudentClick(s)} style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"6px",padding:"6px 10px",marginBottom:"4px",cursor:"pointer",transition:"all .15s"}}
                      onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                      <span style={{fontWeight:700,color:teacher.color,fontFamily:C.font}}>{s.name}</span>
                      <span style={{color:C.muted,fontSize:"0.75rem",marginLeft:"6px",fontFamily:C.font}}>{s.grade}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // PC: 기존 테이블
  return (
    <div>
      {studentTags}
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
              return (
                <tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`}}>
                  <td style={{padding:"2px 10px",color:isHour?C.text2:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none",background:C.card2,fontWeight:600}}>{time}</td>
                  {DAYS.map(day=>{
                    const here=getStudentsForSlot(day,time);
                    return (
                      <td key={day} style={{padding:"1px 3px",verticalAlign:"top",minWidth:"64px"}}>
                        {isHour&&here.map(s=>(
                          <div key={s.id} onClick={()=>onStudentClick(s)}
                            style={{background:teacher.color+"15",borderLeft:`3px solid ${teacher.color}`,borderRadius:"5px",padding:"2px 6px",marginBottom:"2px",fontSize:"0.7rem",color:C.text,fontFamily:C.font,cursor:"pointer",transition:"all .15s"}}
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
function PdfModal({teachers, students, onClose}) {
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
    if(selTeacher==="all") return true;
    return (sc.teacherId||s.teacherId)===selTeacher;
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

  return (
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
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"400px",fontSize:"0.72rem"}}>
          <thead><tr style={{background:C.card2}}>
            <th style={{padding:"6px 10px",color:C.muted,fontSize:"0.68rem",textAlign:"left",minWidth:"50px",borderBottom:`2px solid ${C.border}`}}>시간</th>
            {showDays.map(d=><th key={d} style={{padding:"6px 10px",color:C.text2,fontSize:"0.74rem",textAlign:"center",borderBottom:`2px solid ${C.border}`,minWidth:"80px",fontWeight:700}}>{d}요일</th>)}
          </tr></thead>
          <tbody>
            {showTimes.map(time=>{
              const isHour=time.endsWith(":00");
              return (<tr key={time} style={{borderTop:isHour?`1.5px solid ${C.border}`:`1px dashed ${C.border}`}}>
                <td style={{padding:"3px 10px",color:isHour?C.text2:"transparent",fontSize:"0.66rem",whiteSpace:"nowrap",background:C.card2,fontWeight:600}}>{time}</td>
                {showDays.map(d=>{const here=getSlots(d,time);return(<td key={d} style={{padding:"2px 3px",verticalAlign:"top"}}>
                  {isHour&&here.map(s=>(<div key={s.id} style={{background:s._teacher?s._teacher.color+"15":"#eff6ff",borderLeft:`3px solid ${s._teacher?.color||C.accent}`,borderRadius:"4px",padding:"2px 5px",marginBottom:"2px",fontSize:"0.67rem",color:C.text,fontFamily:C.font}}><span style={{fontWeight:700,color:s._teacher?.color||C.accent}}>{s.name}</span><span style={{color:C.muted,marginLeft:"3px"}}>{s.grade}</span></div>))}
                  {!isHour&&here.map(s=>(<div key={s.id} style={{height:"5px",borderRadius:"2px",background:s._teacher?s._teacher.color+"40":"#bfdbfe",marginBottom:"2px"}}/>))}
                </td>);})}</tr>);
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

/* ── 레포트 (가나다순 + 검색 + 수정 가능) ── */
function ReportModal({students, onUpdateRecord}) {
  const now=new Date();
  const [selYM,setSelYM]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [selSid,setSelSid]=useState("all");
  const [editCell,setEditCell]=useState(null);
  const [reportSearch,setReportSearch]=useState("");
  const dates=useMemo(()=>monthDates(selYM),[selYM]);

  // 학년+이름 가나다순 정렬
  const sortedStudents = useMemo(()=>sortStudents(students),[students]);

  // 검색 필터
  const filteredTargets = useMemo(()=>{
    let base = selSid==="all" ? sortedStudents : sortedStudents.filter(s=>s.id===selSid);
    if(reportSearch.trim()){
      const q=reportSearch.toLowerCase();
      base=base.filter(s=>s.name?.includes(q)||s.school?.toLowerCase().includes(q)||s.grade?.includes(q));
    }
    return base;
  },[selSid, sortedStudents, reportSearch]);

  function doDetail(){
    const[y,m]=selYM.split("-");const rows=[];
    filteredTargets.forEach(s=>dates.forEach(date=>{const r=s.records?.[date]||{};if(r.att||r.hw||r.memo)rows.push([s.name,s.grade,s.school,date,ATT_LABEL[r.att]||"",r.hw?.toUpperCase()||"",r.memo||""]);})
    );exportCSV(`출결_숙제_상세_${y}년${m}월`,["이름","학년","학교","날짜","출결","숙제","메모"],rows);
  }
  function doSummary(){
    const[y,m]=selYM.split("-");
    const rows=filteredTargets.map(s=>{const recs=dates.map(d=>s.records?.[d]||{});return[s.name,s.grade,s.school,recs.filter(r=>r.att==="present").length,recs.filter(r=>r.att==="absent").length,recs.filter(r=>r.att==="makeup").length,...HW_OPTS.map(h=>recs.filter(r=>r.hw===h).length)];});
    exportCSV(`출결_숙제_요약_${y}년${m}월`,["이름","학년","학교","출석","결석","보강","A","B","C","D","N"],rows);
  }

  function CellEditor({student, date, onClose}) {
    const rec=student.records?.[date]||{};
    const [att,setAtt]=useState(rec.att||"");const [hw,setHw]=useState(rec.hw||"");const [memo,setMemo]=useState(rec.memo||"");
    async function save(){const nr={...rec};if(att)nr.att=att;else delete nr.att;if(hw)nr.hw=hw;else delete nr.hw;if(memo)nr.memo=memo;else delete nr.memo;await onUpdateRecord(student.id,date,nr);onClose();}
    async function clear(){await onUpdateRecord(student.id,date,{});onClose();}
    return (
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

  return (
    <div>
      {editCell&&<CellEditor student={students.find(s=>s.id===editCell.sid)} date={editCell.date} onClose={()=>setEditCell(null)}/>}

      {/* 컨트롤 바 */}
      <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
        <input type="month" value={selYM} onChange={e=>setSelYM(e.target.value)} style={{background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}/>
        <select value={selSid} onChange={e=>{setSelSid(e.target.value);setReportSearch("");}} style={{background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
          <option value="all">전체 원생</option>
          {sortedStudents.map(s=><option key={s.id} value={s.id}>{s.name} ({s.grade})</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:"6px"}}>
          <Btn sm v="success" onClick={doSummary}>📊 요약 엑셀</Btn>
          <Btn sm onClick={doDetail}>📥 상세 엑셀</Btn>
        </div>
      </div>

      {/* 검색창 (전체 원생 선택 시에만 표시) */}
      {selSid==="all"&&(
        <input value={reportSearch} onChange={e=>setReportSearch(e.target.value)}
          placeholder="🔍 이름·학교·학년 검색"
          style={{width:"100%",background:C.card2,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"8px 14px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font,boxSizing:"border-box",marginBottom:"0.75rem"}}
          onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
      )}

      <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"0.75rem",fontFamily:C.font,background:"#fff7ed",padding:"8px 12px",borderRadius:"8px",border:"1px solid #fed7aa"}}>
        💡 날짜 칸을 클릭하면 출결/숙제를 직접 수정할 수 있어요 · 학년+이름 가나다순 정렬
      </div>

      {filteredTargets.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"2rem",fontFamily:C.font}}>검색 결과가 없습니다</div>}

      {filteredTargets.map(s=>{
        const recs=dates.map(d=>({date:d,...(s.records?.[d]||{})}));
        return(
          <div key={s.id} style={{background:C.card2,borderRadius:"12px",padding:"1rem",marginBottom:"1rem",border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",flexWrap:"wrap",gap:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <div style={{width:"32px",height:"32px",borderRadius:"50%",background:C.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:C.accent,fontSize:"0.85rem"}}>{s.name[0]}</div>
                <div>
                  <span style={{fontWeight:700,fontSize:"0.95rem",fontFamily:C.font,color:C.text}}>{s.name}</span>
                  <span style={{color:C.muted,fontSize:"0.76rem",fontFamily:C.font,marginLeft:"6px"}}>{s.grade} · {s.school}</span>
                </div>
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
                  style={{width:"34px",height:"48px",borderRadius:"7px",background:att?ATT_COLOR[att]+"12":"#fff",border:`1.5px solid ${att?ATT_COLOR[att]:C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px",cursor:"pointer",transition:"all .15s",boxShadow:"0 1px 2px rgba(0,0,0,.06)"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 4px 10px rgba(0,0,0,.1)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,.06)";}}>
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
function StudentDetail({student, teacher, onEdit, onDelete, onUpdateRecord}) {
  const td=today();const rec=student.records?.[td]||{};
  const [hw,setHw]=useState(rec.hw||"");const [memo,setMemo]=useState(rec.memo||"");const [saved,setSaved]=useState(false);
  const curAtt=student.records?.[td]?.att;
  function saveRec(att){onUpdateRecord(student.id,td,{...(student.records?.[td]||{}),att,hw:hw||(student.records?.[td]?.hw||""),memo:memo||(student.records?.[td]?.memo||"")});}
  function saveHwMemo(){onUpdateRecord(student.id,td,{...(student.records?.[td]||{}),hw,memo});setSaved(true);setTimeout(()=>setSaved(false),2000);}
  return (
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
              <button key={k} onClick={()=>saveRec(k)} style={{flex:1,border:`2px solid ${curAtt===k?ATT_COLOR[k]:C.border}`,borderRadius:"10px",padding:"9px 4px",background:curAtt===k?ATT_COLOR[k]+"18":"#fff",color:curAtt===k?ATT_COLOR[k]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.82rem",transition:"all .15s"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.75rem",color:C.text2,marginBottom:"6px",fontFamily:C.font,fontWeight:600}}>오늘 숙제</div>
          <div style={{display:"flex",gap:"5px",marginBottom:"4px"}}>
            {HW_OPTS.map(h=><button key={h} onClick={()=>setHw(hw===h?"":h)} style={{flex:1,border:`2px solid ${hw===h?HW_COLOR[h]:C.border}`,borderRadius:"8px",padding:"7px 2px",background:hw===h?HW_COLOR[h]+"18":"#fff",color:hw===h?HW_COLOR[h]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:800,fontSize:"0.9rem",transition:"all .15s"}}>{h.toUpperCase()}</button>)}
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
function StudentForm({init, teachers, onSave, onClose}) {
  const blank={id:`s_${Date.now()}`,name:"",grade:GRADES[0],school:"",subject:SUBJECTS[0],textbooks:"",memo:"",teacherId:null,schedule:[],records:{}};
  const [f,sf]=useState(init||blank);
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  const handleTeacherChange=(tid)=>{const upd=(f.schedule||[]).map(sc=>!sc.teacherId?{...sc,teacherId:tid||null}:sc);sf(p=>({...p,teacherId:tid||null,schedule:upd}));};
  return (
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
function TeacherForm({init, onSave, onClose}) {
  const blank={id:`t_${Date.now()}`,name:"",subject:SUBJECTS[0],color:TCOLORS[4]};
  const [f,sf]=useState(init||blank);
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  return (
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

/* ══ 메인 ══ */
export default function App() {
  const [user,setUser]=useState(undefined);
  const [students,setStudents]=useState([]);
  const [teachers,setTeachers]=useState([]);
  const [tab,setTab]=useState("schedule");
  const [schedView,setSchedView]=useState("full");
  const [tvId,setTvId]=useState(null);

  // 모달 스택: 여러 모달이 겹칠 때 zIndex 제어
  const [selS,setSelS]=useState(null);
  const [editS,setEditS]=useState(null);
  const [addS,setAddS]=useState(false);
  const [selT,setSelT]=useState(null);
  const [editT,setEditT]=useState(null);
  const [addT,setAddT]=useState(false);
  const [showReport,setShowReport]=useState(false);
  const [showPdf,setShowPdf]=useState(false);
  // 시간표 모달 위에 학생 상세가 뜰 때를 위한 별도 상태
  const [scheduleStudentModal,setScheduleStudentModal]=useState(null);

  const [search,setSearch]=useState("");
  const [fT,setFT]=useState("all");
  const [fSub,setFSub]=useState("all");

  useEffect(()=>{return onAuthStateChanged(auth,u=>setUser(u||null));},[]);
  useEffect(()=>{
    if(!user) return;
    const u1=onSnapshot(collection(db,"students"),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2=onSnapshot(collection(db,"teachers"),snap=>setTeachers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  },[user]);

  const saveStudent=async s=>setDoc(doc(db,"students",s.id),s);
  const saveTeacher=async t=>setDoc(doc(db,"teachers",t.id),t);
  const delStudent=async id=>{if(confirm("원생을 삭제할까요?")){await deleteDoc(doc(db,"students",id));setSelS(null);setScheduleStudentModal(null);}};
  const delTeacher=async id=>{if(confirm("선생님을 삭제할까요?")){await deleteDoc(doc(db,"teachers",id));for(const s of students.filter(s=>s.teacherId===id))await setDoc(doc(db,"students",s.id),{...s,teacherId:null});setSelT(null);}};
  const updateRecord=async(sid,date,rec)=>{const s=students.find(x=>x.id===sid);if(!s)return;await setDoc(doc(db,"students",sid),{...s,records:{...(s.records||{}),[date]:rec}});};

  // 시간표에서 학생 클릭 → 별도 고zIndex 모달
  const handleStudentClick=(s)=>setScheduleStudentModal(s);
  // 원생 탭에서 클릭
  const handleStudentTabClick=(s)=>{setSelS(s);};

  // 학년+이름 정렬된 원생 목록
  const sortedStudents = useMemo(()=>sortStudents(students),[students]);

  const filtered=useMemo(()=>{
    const q=search.toLowerCase();
    return sortedStudents.filter(s=>
      (!q||s.name?.includes(q)||s.school?.toLowerCase().includes(q)||s.grade?.includes(q))
      &&(fT==="all"||s.teacherId===fT)
      &&(fSub==="all"||s.subject===fSub)
    );
  },[sortedStudents,search,fT,fSub]);

  const td=today();
  const todayAtts=students.map(s=>s.records?.[td]?.att).filter(Boolean);
  const TABS=[{id:"schedule",l:"📅 시간표"},{id:"students",l:"👨‍🎓 원생"},{id:"teachers",l:"👩‍🏫 선생님"}];

  if(user===undefined) return <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:C.font}}>로딩 중...</div>;
  if(!user) return <LoginScreen/>;

  // 시간표 선생님 모달 안에서 쓰는 현재 학생 데이터
  const schedStudentData = scheduleStudentModal ? students.find(s=>s.id===scheduleStudentModal.id)||scheduleStudentModal : null;

  const isMobile=useIsMobile();

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.font}}>
      {/* ── 헤더 (모바일: 2줄) ── */}
      <header style={{background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        {isMobile?(
          /* 모바일 헤더 */
          <div>
            <div style={{padding:"0 1rem",display:"flex",alignItems:"center",justifyContent:"space-between",height:"48px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                <div style={{width:"28px",height:"28px",borderRadius:"8px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem"}}>📐</div>
                <span style={{fontWeight:800,fontSize:"0.9rem",color:C.text}}>봄 학원 관리</span>
              </div>
              <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                <Btn sm v="ghost" onClick={()=>setShowPdf(true)}>🖨️ PDF</Btn>
                <Btn sm v="purple" onClick={()=>setShowReport(true)}>📊</Btn>
                <button onClick={()=>signOut(auth)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.75rem",fontFamily:C.font}}>로그아웃</button>
              </div>
            </div>
            {/* 하단 탭바 */}
            <div style={{display:"flex",borderTop:`1px solid ${C.border}`}}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,border:"none",padding:"8px 4px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.75rem",background:tab===t.id?"#eff6ff":C.card,color:tab===t.id?C.accent:C.text2,borderBottom:tab===t.id?`2px solid ${C.accent}`:"2px solid transparent",transition:"all .15s"}}>{t.l}</button>
              ))}
            </div>
          </div>
        ):(
          /* PC 헤더 */
          <div style={{maxWidth:"1300px",margin:"0 auto",padding:"0 1.25rem",display:"flex",alignItems:"center",height:"56px",gap:"1.25rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
              <div style={{width:"32px",height:"32px",borderRadius:"9px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",boxShadow:"0 2px 8px rgba(59,130,246,.3)"}}>📐</div>
              <span style={{fontWeight:800,fontSize:"1rem",letterSpacing:"-0.02em",color:C.text}}>봄 학원 관리</span>
            </div>
            <nav style={{display:"flex",gap:"4px"}}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{border:"none",borderRadius:"8px",padding:"6px 16px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.83rem",background:tab===t.id?"#eff6ff":C.bg,color:tab===t.id?C.accent:C.text2,transition:"all .15s",boxShadow:tab===t.id?"inset 0 0 0 1.5px #bfdbfe":"none"}}>{t.l}</button>
              ))}
            </nav>
            <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
              <Btn sm v="ghost" onClick={()=>setShowPdf(true)}>🖨️ 시간표 PDF</Btn>
              <Btn sm v="purple" onClick={()=>setShowReport(true)}>📊 레포트</Btn>
              <span style={{fontSize:"0.72rem",color:C.muted}}>{user.email}</span>
              <button onClick={()=>signOut(auth)} style={{background:"#fff",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"4px 12px",color:C.text2,cursor:"pointer",fontSize:"0.72rem",fontFamily:C.font}}
                onMouseEnter={e=>e.currentTarget.style.background=C.bg} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>로그아웃</button>
            </div>
          </div>
        )}
      </header>

      <main style={{maxWidth:"1300px",margin:"0 auto",padding:isMobile?"0.75rem":"1.25rem"}}>
        {/* 통계 (모바일: 2x2, PC: 4열) */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:isMobile?"8px":"12px",marginBottom:isMobile?"0.75rem":"1.25rem"}}>
          {[{l:"전체 원생",v:`${students.length}명`,icon:"👨‍🎓",c:"#3b82f6",bg:"#eff6ff"},{l:"선생님",v:`${teachers.length}명`,icon:"👩‍🏫",c:"#8b5cf6",bg:"#f5f3ff"},{l:"오늘 출석",v:`${todayAtts.filter(a=>a==="present").length}명`,icon:"✅",c:"#10b981",bg:"#f0fdf4"},{l:"오늘 결석",v:`${todayAtts.filter(a=>a==="absent").length}명`,icon:"❌",c:"#ef4444",bg:"#fef2f2"}].map(({l,v,icon,c,bg})=>(
            <div key={l} style={{background:C.card,borderRadius:"12px",padding:isMobile?"0.7rem":"1rem 1.1rem",border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div><div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"4px",fontWeight:600}}>{l}</div><div style={{fontWeight:800,fontSize:isMobile?"0.95rem":"1.1rem",color:c}}>{v}</div></div>
                <div style={{width:isMobile?"28px":"36px",height:isMobile?"28px":"36px",borderRadius:"10px",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?"0.85rem":"1.1rem"}}>{icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 시간표 탭 */}
        {tab==="schedule"&&(
          <div style={{background:C.card,borderRadius:"14px",border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <div style={{padding:"1rem 1.25rem",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
              <h2 style={{margin:0,fontSize:"0.95rem",fontWeight:700,color:C.text}}>📅 시간표 <span style={{color:C.muted,fontSize:"0.8rem",fontWeight:400}}>(학생 이름 클릭 → 상세보기)</span></h2>
              <div style={{display:"flex",gap:"4px",background:C.bg,borderRadius:"10px",padding:"3px"}}>
                {[{id:"full",l:"전체"},{id:"byTeacher",l:"선생님별"}].map(sv=>(
                  <button key={sv.id} onClick={()=>setSchedView(sv.id)} style={{border:"none",borderRadius:"8px",padding:"5px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.78rem",background:schedView===sv.id?C.card:"transparent",color:schedView===sv.id?C.accent:C.muted,boxShadow:schedView===sv.id?"0 1px 3px rgba(0,0,0,.08)":"none",transition:"all .15s"}}>{sv.l}</button>
                ))}
              </div>
            </div>
            <div style={{padding:"1rem 1.25rem"}}>
              {schedView==="full"&&<FullSched teachers={teachers} students={students} onStudentClick={handleStudentClick}/>}
              {schedView==="byTeacher"&&(
                <div>
                  <div style={{display:"flex",gap:"6px",marginBottom:"1rem",flexWrap:"wrap"}}>
                    {teachers.map(t=><button key={t.id} onClick={()=>setTvId(t.id)} style={{border:`2px solid ${tvId===t.id?t.color:C.border}`,borderRadius:"9px",padding:"5px 16px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.8rem",background:tvId===t.id?t.color+"15":"#fff",color:tvId===t.id?t.color:C.text2,transition:"all .15s"}}>{t.name}</button>)}
                  </div>
                  {tvId
                    ? <TeacherSched teacher={teachers.find(x=>x.id===tvId)} students={students} onStudentClick={handleStudentClick}/>
                    : <div style={{color:C.muted,textAlign:"center",padding:"3rem"}}>선생님을 선택하세요</div>
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* 원생 탭 */}
        {tab==="students"&&(
          <div>
            {/* 검색/필터 (모바일: 세로 배치) */}
            <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 이름·학교·학년 검색"
                style={{flex:1,minWidth:"0",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"10px",padding:"8px 14px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font,width:isMobile?"100%":"auto",boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              {!isMobile&&<>
                <select value={fT} onChange={e=>setFT(e.target.value)} style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"10px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
                  <option value="all">전체 선생님</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={fSub} onChange={e=>setFSub(e.target.value)} style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"10px",padding:"8px 12px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
                  <option value="all">전체 과목</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </>}
              <Btn onClick={()=>setAddS(true)} style={isMobile?{width:"100%"}:{}}>+ 원생 추가</Btn>
            </div>
            {/* 모바일 필터 (선생님/과목) */}
            {isMobile&&(
              <div style={{display:"flex",gap:"6px",marginBottom:"0.75rem"}}>
                <select value={fT} onChange={e=>setFT(e.target.value)} style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.82rem",outline:"none",fontFamily:C.font}}>
                  <option value="all">전체 선생님</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={fSub} onChange={e=>setFSub(e.target.value)} style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:"8px",padding:"7px 10px",color:C.text,fontSize:"0.82rem",outline:"none",fontFamily:C.font}}>
                  <option value="all">전체 과목</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {/* 원생 목록: 모바일=리스트, PC=카드 */}
            {isMobile?(
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {filtered.map(st=>{
                  const teacher=teachers.find(t=>t.id===st.teacherId);const tr=st.records?.[td]||{};
                  return(
                    <div key={st.id} onClick={()=>handleStudentTabClick(st)}
                      style={{background:C.card,borderRadius:"12px",padding:"0.85rem 1rem",border:`1px solid ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",gap:"12px",boxShadow:"0 1px 3px rgba(0,0,0,.06)",position:"relative",overflow:"hidden"}}>
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
                      <span style={{color:C.muted,fontSize:"1.2rem"}}>›</span>
                    </div>
                  );
                })}
                {filtered.length===0&&<div style={{textAlign:"center",color:C.muted,padding:"3rem"}}>원생이 없습니다</div>}
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:"12px"}}>
                {filtered.map(st=>{
                  const teacher=teachers.find(t=>t.id===st.teacherId);const tr=st.records?.[td]||{};
                  return (
                    <div key={st.id} onClick={()=>handleStudentTabClick(st)} style={{background:C.card,borderRadius:"13px",padding:"1.1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .2s",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=teacher?.color||C.accent;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,.1)";}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)";}}>
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
                {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",color:C.muted,padding:"3rem"}}>원생이 없습니다</div>}
              </div>
            )}
          </div>
        )}

        {/* 선생님 탭 */}
        {tab==="teachers"&&(
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"1rem"}}><Btn onClick={()=>setAddT(true)}>+ 선생님 추가</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:"12px"}}>
              {teachers.map(t=>{
                const mine=[...new Map(students.filter(s=>s.schedule?.some(sc=>(sc.teacherId||s.teacherId)===t.id)).map(s=>[s.id,s])).values()];
                return (
                  <div key={t.id} onClick={()=>setSelT(t)} style={{background:C.card,borderRadius:"13px",padding:"1.1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"all .2s",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=t.color;e.currentTarget.style.boxShadow="0 8px 20px rgba(0,0,0,.1)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)";}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"4px",background:t.color,borderRadius:"13px 13px 0 0"}}/>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                      <div style={{width:"40px",height:"40px",borderRadius:"50%",background:t.color+"20",border:`2px solid ${t.color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:t.color,fontSize:"1.05rem",flexShrink:0}}>{t.name[0]}</div>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:"0.95rem",color:C.text}}>{t.name}</div><div style={{color:C.muted,fontSize:"0.72rem"}}>{t.subject}</div></div>
                      <div style={{fontWeight:800,fontSize:"1rem",color:t.color}}>{mine.length}명</div>
                    </div>
                    <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                      {mine.map(s=><Tag key={s.id} c={t.color}>{s.name}</Tag>)}
                      {mine.length===0&&<span style={{fontSize:"0.74rem",color:C.muted}}>담당 원생 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ── 모달들 ── */}

      {/* 원생 탭 상세 (zIndex 200) */}
      {selS&&!editS&&(
        <Modal title={`${selS.name} 원생 상세`} onClose={()=>setSelS(null)} wide zIndex={200}>
          <StudentDetail student={students.find(s=>s.id===selS.id)||selS} teacher={teachers.find(t=>t.id===selS.teacherId)}
            onEdit={()=>setEditS(students.find(s=>s.id===selS.id))} onDelete={()=>delStudent(selS.id)} onUpdateRecord={updateRecord}/>
        </Modal>
      )}
      {editS&&(<Modal title="원생 정보 수정" onClose={()=>setEditS(null)} wide zIndex={210}><StudentForm init={editS} teachers={teachers} onSave={saveStudent} onClose={()=>{setEditS(null);setSelS(null);}}/></Modal>)}
      {addS&&(<Modal title="원생 추가" onClose={()=>setAddS(false)} wide zIndex={200}><StudentForm teachers={teachers} onSave={saveStudent} onClose={()=>setAddS(false)}/></Modal>)}

      {/* 선생님 시간표 모달 (zIndex 200) */}
      {selT&&!editT&&(
        <Modal title={`${selT.name} 시간표`} onClose={()=>setSelT(null)} wide zIndex={200}>
          <div style={{display:"flex",gap:"6px",marginBottom:"1rem"}}>
            <Btn sm onClick={()=>setEditT(selT)}>✏️ 정보 수정</Btn>
            <Btn sm v="danger" onClick={()=>delTeacher(selT.id)}>🗑️ 삭제</Btn>
          </div>
          <TeacherSched teacher={selT} students={students} onStudentClick={handleStudentClick}/>
        </Modal>
      )}
      {editT&&(<Modal title="선생님 정보 수정" onClose={()=>setEditT(null)} zIndex={210}><TeacherForm init={editT} onSave={saveTeacher} onClose={()=>{setEditT(null);setSelT(null);}}/></Modal>)}
      {addT&&(<Modal title="선생님 추가" onClose={()=>setAddT(false)} zIndex={200}><TeacherForm onSave={saveTeacher} onClose={()=>setAddT(false)}/></Modal>)}

      {/* 시간표에서 학생 클릭 시 → zIndex 300 (선생님 모달 위에) */}
      {schedStudentData&&(
        <Modal title={`${schedStudentData.name} 원생 상세`} onClose={()=>setScheduleStudentModal(null)} wide zIndex={300}>
          <StudentDetail student={schedStudentData} teacher={teachers.find(t=>t.id===schedStudentData.teacherId)}
            onEdit={()=>{setEditS(schedStudentData);setScheduleStudentModal(null);}}
            onDelete={()=>delStudent(schedStudentData.id)}
            onUpdateRecord={updateRecord}/>
        </Modal>
      )}

      {/* 레포트 / PDF */}
      {showReport&&(<Modal title="📊 월별 출결·숙제 레포트" onClose={()=>setShowReport(false)} wide zIndex={200}><ReportModal students={students} onUpdateRecord={updateRecord}/></Modal>)}
      {showPdf&&(<Modal title="🖨️ 시간표 PDF 출력" onClose={()=>setShowPdf(false)} wide zIndex={200}><PdfModal teachers={teachers} students={students} onClose={()=>setShowPdf(false)}/></Modal>)}
    </div>
  );
}
