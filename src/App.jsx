import { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";

/* ── Firebase 초기화 ── */
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
const DAYS    = ["월","화","수","목","금","토"];
const TIMES   = [];
for(let h=13;h<=21;h++){TIMES.push(`${String(h).padStart(2,'0')}:00`);if(h<21)TIMES.push(`${String(h).padStart(2,'0')}:30`);}
const GRADES   = ["초1","초2","초3","초4","초5","초6","중1","중2","중3","고1","고2","고3"];
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

const C = {bg:"#0d1117",card:"#161b22",border:"#21262d",text:"#e6edf3",muted:"#7d8590",font:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif"};

/* ── 공통 컴포넌트 ── */
const Tag = ({c="#3b82f6",children}) => (
  <span style={{fontSize:"0.68rem",padding:"2px 8px",borderRadius:"20px",background:c+"22",color:c,fontFamily:C.font,fontWeight:600,whiteSpace:"nowrap"}}>{children}</span>
);

const Btn = ({children,v="primary",sm,style:xs,...p}) => {
  const m={primary:{bg:"#3b82f6",fg:"#fff"},ghost:{bg:"#21262d",fg:C.text},danger:{bg:"#ef4444",fg:"#fff"},success:{bg:"#10b981",fg:"#fff"},purple:{bg:"#8b5cf6",fg:"#fff"}};
  const st=m[v]||m.primary;
  return <button {...p} style={{border:"none",borderRadius:"7px",cursor:"pointer",fontFamily:C.font,fontWeight:600,padding:sm?"3px 10px":"7px 16px",fontSize:sm?"0.74rem":"0.85rem",background:st.bg,color:st.fg,transition:"opacity .15s",...xs}} onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;
};

const Inp = ({label,...p}) => (
  <div style={{marginBottom:"0.85rem"}}>
    {label&&<div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"3px",fontFamily:C.font}}>{label}</div>}
    <input {...p} style={{width:"100%",background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,...p.style}}/>
  </div>
);

const Sel = ({label,opts,...p}) => (
  <div style={{marginBottom:"0.85rem"}}>
    {label&&<div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"3px",fontFamily:C.font}}>{label}</div>}
    <select {...p} style={{width:"100%",background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font}}>
      {opts.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  </div>
);

const Modal = ({title,onClose,wide,children}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.68)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <div style={{background:C.card,borderRadius:"14px",padding:"1.5rem",width:"100%",maxWidth:wide?"900px":"500px",maxHeight:"93vh",overflowY:"auto",border:`1px solid ${C.border}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
        <h3 style={{margin:0,color:C.text,fontSize:"1rem",fontFamily:C.font}}>{title}</h3>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1.4rem",lineHeight:1}}>×</button>
      </div>
      {children}
    </div>
  </div>
);

/* ── 로그인 화면 ── */
function LoginScreen() {
  const [email,setEmail]  = useState("");
  const [pw,setPw]        = useState("");
  const [err,setErr]      = useState("");
  const [loading,setLoad] = useState(false);

  async function handleLogin() {
    if(!email||!pw) return setErr("이메일과 비밀번호를 입력하세요");
    setLoad(true); setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch(e) {
      setErr("이메일 또는 비밀번호가 올바르지 않습니다");
    }
    setLoad(false);
  }

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.font}}>
      <div style={{background:C.card,borderRadius:"16px",padding:"2.5rem 2rem",width:"100%",maxWidth:"360px",border:`1px solid ${C.border}`}}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{width:"48px",height:"48px",borderRadius:"12px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",margin:"0 auto 1rem"}}>📐</div>
          <div style={{fontWeight:800,fontSize:"1.3rem",color:C.text}}>봄 학원 관리</div>
          <div style={{color:C.muted,fontSize:"0.8rem",marginTop:"4px"}}>Bom Schedule</div>
        </div>
        <Inp label="이메일" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="teacher@academy.com" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        <Inp label="비밀번호" type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="비밀번호 입력" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/>
        {err && <div style={{color:"#ef4444",fontSize:"0.78rem",marginBottom:"0.85rem",fontFamily:C.font}}>{err}</div>}
        <Btn style={{width:"100%",padding:"10px"}} onClick={handleLogin} disabled={loading}>
          {loading ? "로그인 중..." : "로그인"}
        </Btn>
        <div style={{marginTop:"1.5rem",padding:"1rem",background:"#0d1117",borderRadius:"8px",border:`1px solid ${C.border}`}}>
          <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"4px",fontWeight:600}}>👑 계정 관리</div>
          <div style={{fontSize:"0.72rem",color:C.muted,lineHeight:1.7}}>
            선생님 계정은 Firebase 콘솔<br/>
            → Authentication → 사용자 추가
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 30분 시간표 그리드 ── */
function Grid({schedule,onChange,readOnly}) {
  const on  = (d,t) => schedule.some(s=>s.day===d&&s.time===t);
  const tgl = (d,t) => {
    if(readOnly) return;
    on(d,t) ? onChange(schedule.filter(s=>!(s.day===d&&s.time===t))) : onChange([...schedule,{day:d,time:t}]);
  };
  return (
    <div style={{overflowX:"auto"}}>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:"380px"}}>
        <thead>
          <tr>
            <th style={{padding:"4px 6px",color:C.muted,fontSize:"0.66rem",textAlign:"left",width:"46px"}}></th>
            {DAYS.map(d=><th key={d} style={{padding:"4px 5px",color:C.text,fontSize:"0.74rem",textAlign:"center",minWidth:"48px"}}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {TIMES.map(t=>{
            const isHour = t.endsWith(":00");
            return (
              <tr key={t} style={{borderTop:isHour?`1px solid ${C.border}`:"none"}}>
                <td style={{padding:"1px 6px",color:isHour?C.muted:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none"}}>{t}</td>
                {DAYS.map(d=>{
                  const active = on(d,t);
                  return (
                    <td key={d} style={{padding:"1px 2px"}} onClick={()=>tgl(d,t)}>
                      <div style={{width:"100%",height:"20px",borderRadius:isHour?"3px 3px 0 0":"0 0 3px 3px",background:active?"#3b82f6":"#0d1117",border:`1px solid ${active?"#3b82f6":C.border}`,cursor:readOnly?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .1s"}}>
                        {active&&isHour&&<span style={{color:"#fff",fontSize:"0.55rem"}}>●</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {!readOnly&&<p style={{color:C.muted,fontSize:"0.7rem",marginTop:"5px",fontFamily:C.font}}>※ 클릭으로 선택 (30분 단위)</p>}
    </div>
  );
}

/* ── 전체 시간표 ── */
function FullSched({teachers,students}) {
  const [day,setDay] = useState("전체");
  const showDays = day==="전체" ? DAYS : [day];
  return (
    <div>
      <div style={{display:"flex",gap:"5px",marginBottom:"1rem",flexWrap:"wrap"}}>
        {["전체",...DAYS].map(d=><button key={d} onClick={()=>setDay(d)} style={{border:"none",borderRadius:"6px",padding:"4px 11px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.76rem",background:day===d?"#3b82f6":"#21262d",color:day===d?"#fff":C.muted}}>{d}</button>)}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"460px"}}>
          <thead>
            <tr>
              <th style={{padding:"5px 8px",color:C.muted,fontSize:"0.66rem",textAlign:"left",minWidth:"48px",borderBottom:`1px solid ${C.border}`}}>시간</th>
              {showDays.map(d=><th key={d} style={{padding:"5px 8px",color:C.text,fontSize:"0.76rem",textAlign:"center",borderBottom:`1px solid ${C.border}`,minWidth:"82px"}}>{d}요일</th>)}
            </tr>
          </thead>
          <tbody>
            {TIMES.map(time=>{
              const isHour = time.endsWith(":00");
              const byday  = {};
              showDays.forEach(d=>{byday[d]=students.filter(s=>s.schedule?.some(sc=>sc.day===d&&sc.time===time)).map(s=>({...s,teacher:teachers.find(t=>t.id===s.teacherId)}));});
              return (
                <tr key={time} style={{borderTop:isHour?`1px solid ${C.border}`:"none"}}>
                  <td style={{padding:"2px 8px",color:isHour?C.muted:"transparent",fontSize:"0.65rem",whiteSpace:"nowrap",background:C.card,userSelect:"none"}}>{time}</td>
                  {showDays.map(d=>(
                    <td key={d} style={{padding:"2px 3px",verticalAlign:"top",background:"#0d1117",minWidth:"82px"}}>
                      {byday[d].map(s=>(
                        <div key={s.id} style={{background:(s.teacher?.color||"#3b82f6")+"18",borderLeft:`3px solid ${s.teacher?.color||"#3b82f6"}`,borderRadius:"4px",padding:"2px 5px",marginBottom:"2px",fontSize:"0.68rem",color:C.text,fontFamily:C.font,lineHeight:1.5}}>
                          <span style={{fontWeight:700}}>{s.name}</span>
                          <span style={{color:C.muted,marginLeft:"3px",fontSize:"0.6rem"}}>{s.grade}</span>
                          {s.teacher&&<div style={{color:s.teacher.color,fontSize:"0.6rem"}}>{s.teacher.name}</div>}
                        </div>
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

/* ── 선생님별 시간표 ── */
function TeacherSched({teacher,students}) {
  const mine = students.filter(s=>s.teacherId===teacher.id);
  return (
    <div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1rem"}}>
        {mine.map(s=><div key={s.id} style={{background:teacher.color+"18",borderRadius:"6px",padding:"4px 10px"}}><span style={{color:teacher.color,fontWeight:700,fontSize:"0.8rem",fontFamily:C.font}}>{s.name}</span><span style={{color:C.muted,fontSize:"0.7rem",marginLeft:"5px",fontFamily:C.font}}>{s.grade}</span></div>)}
        {mine.length===0&&<span style={{color:C.muted,fontSize:"0.8rem",fontFamily:C.font}}>담당 원생 없음</span>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",minWidth:"420px"}}>
          <thead><tr><th style={{padding:"4px 8px",color:C.muted,fontSize:"0.65rem",textAlign:"left",width:"46px"}}></th>{DAYS.map(d=><th key={d} style={{padding:"4px 8px",color:C.text,fontSize:"0.74rem",textAlign:"center",minWidth:"64px"}}>{d}</th>)}</tr></thead>
          <tbody>
            {TIMES.map(time=>{
              const isHour = time.endsWith(":00");
              return (
                <tr key={time} style={{borderTop:isHour?`1px solid ${C.border}`:"none"}}>
                  <td style={{padding:"2px 8px",color:isHour?C.muted:"transparent",fontSize:"0.64rem",whiteSpace:"nowrap",userSelect:"none"}}>{time}</td>
                  {DAYS.map(day=>{
                    const here = mine.filter(s=>s.schedule?.some(sc=>sc.day===day&&sc.time===time));
                    return (
                      <td key={day} style={{padding:"1px 3px",verticalAlign:"top",minWidth:"64px"}}>
                        {here.map(s=>(
                          <div key={s.id} style={{background:teacher.color+"22",borderLeft:`3px solid ${teacher.color}`,borderRadius:"4px",padding:"2px 5px",marginBottom:"2px",fontSize:"0.68rem",color:C.text,fontFamily:C.font}}>
                            <div style={{fontWeight:700}}>{s.name}</div>
                            <div style={{color:C.muted,fontSize:"0.6rem"}}>{s.grade}</div>
                          </div>
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

/* ── CSV 내보내기 ── */
function exportCSV(filename,headers,rows) {
  const bom  = "\uFEFF";
  const esc  = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const lines= [headers.map(esc).join(","),...rows.map(r=>r.map(esc).join(","))];
  const blob = new Blob([bom+lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href=url; a.download=filename+".csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ── 월별 레포트 ── */
function ReportModal({students}) {
  const now = new Date();
  const [selYM,setSelYM]   = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
  const [selSid,setSelSid] = useState("all");
  const targets = selSid==="all" ? students : students.filter(s=>s.id===selSid);
  const dates   = useMemo(()=>monthDates(selYM),[selYM]);

  function doDetail() {
    const [y,m]=selYM.split("-");
    const rows=[];
    targets.forEach(s=>dates.forEach(date=>{
      const r=s.records?.[date]||{};
      if(r.att||r.hw||r.memo) rows.push([s.name,s.grade,s.school,date,ATT_LABEL[r.att]||"",r.hw?.toUpperCase()||"",r.memo||""]);
    }));
    exportCSV(`출결_숙제_상세_${y}년${m}월`,["이름","학년","학교","날짜","출결","숙제","메모"],rows);
  }

  function doSummary() {
    const [y,m]=selYM.split("-");
    const rows=targets.map(s=>{
      const recs=dates.map(d=>s.records?.[d]||{});
      return[s.name,s.grade,s.school,
        recs.filter(r=>r.att==="present").length,
        recs.filter(r=>r.att==="absent").length,
        recs.filter(r=>r.att==="makeup").length,
        ...HW_OPTS.map(h=>recs.filter(r=>r.hw===h).length)];
    });
    exportCSV(`출결_숙제_요약_${y}년${m}월`,["이름","학년","학교","출석","결석","보강","A","B","C","D","N"],rows);
  }

  return (
    <div>
      <div style={{display:"flex",gap:"8px",marginBottom:"1.25rem",flexWrap:"wrap",alignItems:"center"}}>
        <input type="month" value={selYM} onChange={e=>setSelYM(e.target.value)} style={{background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"6px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}/>
        <select value={selSid} onChange={e=>setSelSid(e.target.value)} style={{background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"6px 10px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
          <option value="all">전체 원생</option>
          {students.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{marginLeft:"auto",display:"flex",gap:"6px"}}>
          <Btn sm v="success" onClick={doSummary}>📊 요약 엑셀</Btn>
          <Btn sm onClick={doDetail}>📥 상세 엑셀</Btn>
        </div>
      </div>
      {targets.map(s=>{
        const recs=dates.map(d=>({date:d,...(s.records?.[d]||{})}));
        return (
          <div key={s.id} style={{background:"#0d1117",borderRadius:"10px",padding:"1rem",marginBottom:"1rem",border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.75rem",flexWrap:"wrap",gap:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontWeight:700,fontSize:"0.93rem",fontFamily:C.font}}>{s.name}</span>
                <span style={{color:C.muted,fontSize:"0.76rem",fontFamily:C.font}}>{s.grade} · {s.school}</span>
              </div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                <Tag c="#10b981">출석 {recs.filter(r=>r.att==="present").length}</Tag>
                <Tag c="#ef4444">결석 {recs.filter(r=>r.att==="absent").length}</Tag>
                <Tag c="#8b5cf6">보강 {recs.filter(r=>r.att==="makeup").length}</Tag>
                {HW_OPTS.map(h=>{const cnt=recs.filter(r=>r.hw===h).length;return cnt>0?<Tag key={h} c={HW_COLOR[h]}>{h.toUpperCase()} {cnt}</Tag>:null;})}
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"3px"}}>
              {recs.map(({date,att,hw})=>(
                <div key={date} title={date} style={{width:"30px",height:"44px",borderRadius:"5px",background:(att||hw)?C.card:"#0d1117",border:`1px solid ${att?ATT_COLOR[att]:C.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"2px"}}>
                  <div style={{fontSize:"0.58rem",color:C.muted,fontFamily:C.font}}>{date.slice(8)}</div>
                  {att&&<div style={{width:"14px",height:"14px",borderRadius:"50%",background:ATT_COLOR[att],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.52rem",color:"#fff",fontWeight:700}}>{att==="present"?"출":att==="absent"?"결":"보"}</div>}
                  {hw&&<div style={{width:"14px",height:"14px",borderRadius:"3px",background:HW_COLOR[hw],display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.58rem",color:"#fff",fontWeight:700}}>{hw.toUpperCase()}</div>}
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
function StudentDetail({student,teacher,onEdit,onDelete,onUpdateRecord}) {
  const td  = today();
  const rec = student.records?.[td]||{};
  const [hw,setHw]       = useState(rec.hw||"");
  const [memo,setMemo]   = useState(rec.memo||"");
  const [saved,setSaved] = useState(false);
  const curAtt = student.records?.[td]?.att;

  function saveRec(att) {
    onUpdateRecord(student.id, td, {...(student.records?.[td]||{}), att, hw:hw||(student.records?.[td]?.hw||""), memo:memo||(student.records?.[td]?.memo||"")});
  }
  function saveHwMemo() {
    onUpdateRecord(student.id, td, {...(student.records?.[td]||{}), hw, memo});
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div>
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"1.25rem"}}>
        <Btn sm onClick={onEdit}>✏️ 수정</Btn>
        <Btn sm v="danger" style={{marginLeft:"auto"}} onClick={onDelete}>🗑️ 삭제</Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"10px"}}>
        {[["이름",student.name],["학년",student.grade],["학교",student.school],["과목",student.subject],["담당",teacher?.name||"미배정"],["연락처",student.parentPhone||"—"]].map(([k,v])=>(
          <div key={k} style={{background:"#0d1117",borderRadius:"8px",padding:"0.6rem 0.8rem"}}>
            <div style={{color:C.muted,fontSize:"0.65rem",marginBottom:"2px",fontFamily:C.font}}>{k}</div>
            <div style={{color:C.text,fontWeight:600,fontSize:"0.85rem",fontFamily:C.font}}>{v}</div>
          </div>
        ))}
      </div>
      {student.textbooks&&<div style={{background:"#0d1117",borderRadius:"8px",padding:"0.6rem 0.8rem",marginBottom:"8px"}}><div style={{color:C.muted,fontSize:"0.65rem",marginBottom:"2px",fontFamily:C.font}}>교재</div><div style={{color:C.text,fontSize:"0.85rem",fontFamily:C.font}}>{student.textbooks}</div></div>}
      {student.memo&&<div style={{background:"#0d1117",borderRadius:"8px",padding:"0.6rem 0.8rem",marginBottom:"8px"}}><div style={{color:C.muted,fontSize:"0.65rem",marginBottom:"2px",fontFamily:C.font}}>메모</div><div style={{color:C.text,fontSize:"0.85rem",fontFamily:C.font}}>{student.memo}</div></div>}

      <div style={{background:"#0d1117",borderRadius:"10px",padding:"1rem",marginBottom:"10px",border:`2px solid ${curAtt?ATT_COLOR[curAtt]:C.border}`}}>
        <div style={{fontWeight:700,fontSize:"0.88rem",marginBottom:"0.85rem",fontFamily:C.font,display:"flex",alignItems:"center",gap:"8px"}}>
          📅 오늘 기록 <span style={{color:C.muted,fontWeight:400,fontSize:"0.78rem"}}>{td}</span>
          {curAtt&&<Tag c={ATT_COLOR[curAtt]}>{ATT_LABEL[curAtt]}</Tag>}
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"6px",fontFamily:C.font}}>출결 상태</div>
          <div style={{display:"flex",gap:"6px"}}>
            {[["present","✅ 출석"],["absent","❌ 결석"],["makeup","🔄 보강"]].map(([k,l])=>(
              <button key={k} onClick={()=>saveRec(k)} style={{flex:1,border:`2px solid ${curAtt===k?ATT_COLOR[k]:C.border}`,borderRadius:"8px",padding:"8px 4px",background:curAtt===k?ATT_COLOR[k]+"22":"#0d1117",color:curAtt===k?ATT_COLOR[k]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:700,fontSize:"0.82rem",transition:"all .1s"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"6px",fontFamily:C.font}}>오늘 숙제 (A:완료 B:대부분 C:절반 D:미흡 N:미제출)</div>
          <div style={{display:"flex",gap:"5px",marginBottom:"4px"}}>
            {HW_OPTS.map(h=>(
              <button key={h} onClick={()=>setHw(hw===h?"":h)} style={{flex:1,border:`2px solid ${hw===h?HW_COLOR[h]:C.border}`,borderRadius:"7px",padding:"6px 2px",background:hw===h?HW_COLOR[h]+"22":"#0d1117",color:hw===h?HW_COLOR[h]:C.muted,cursor:"pointer",fontFamily:C.font,fontWeight:800,fontSize:"0.88rem",transition:"all .1s"}}>{h.toUpperCase()}</button>
            ))}
          </div>
          {hw&&<div style={{fontSize:"0.72rem",color:HW_COLOR[hw],fontFamily:C.font}}>{HW_DESC[hw]}</div>}
        </div>
        <div style={{marginBottom:"0.85rem"}}>
          <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"4px",fontFamily:C.font}}>수업 메모</div>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={2} placeholder="수업 내용, 특이사항..." style={{width:"100%",background:C.card,border:`1px solid ${C.border}`,borderRadius:"7px",padding:"7px 10px",color:C.text,fontSize:"0.85rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,resize:"vertical"}}/>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <Btn onClick={saveHwMemo}>💾 숙제·메모 저장</Btn>
          {saved&&<span style={{color:"#10b981",fontSize:"0.76rem",fontFamily:C.font}}>저장됨 ✓</span>}
        </div>
      </div>

      <div style={{background:"#0d1117",borderRadius:"10px",padding:"1rem",marginBottom:"10px"}}>
        <div style={{fontWeight:700,fontSize:"0.85rem",marginBottom:"0.75rem",fontFamily:C.font}}>📋 최근 기록</div>
        <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
          {Object.entries(student.records||{}).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,20).map(([date,r])=>(
            <div key={date} style={{background:C.card,borderRadius:"6px",padding:"4px 7px",border:`1px solid ${r.att?ATT_COLOR[r.att]:C.border}`,minWidth:"48px",textAlign:"center"}}>
              <div style={{fontSize:"0.6rem",color:C.muted,fontFamily:C.font}}>{date.slice(5)}</div>
              <div style={{display:"flex",gap:"3px",justifyContent:"center",marginTop:"2px"}}>
                {r.att&&<span style={{fontSize:"0.62rem",fontWeight:700,color:ATT_COLOR[r.att]}}>{r.att==="present"?"출":r.att==="absent"?"결":"보"}</span>}
                {r.hw&&<span style={{fontSize:"0.62rem",fontWeight:700,color:HW_COLOR[r.hw]}}>{r.hw.toUpperCase()}</span>}
              </div>
            </div>
          ))}
          {Object.keys(student.records||{}).length===0&&<span style={{color:C.muted,fontSize:"0.78rem",fontFamily:C.font}}>기록 없음</span>}
        </div>
      </div>

      <div style={{background:"#0d1117",borderRadius:"10px",padding:"1rem"}}>
        <div style={{fontWeight:700,fontSize:"0.85rem",marginBottom:"0.75rem",fontFamily:C.font}}>🗓 시간표</div>
        <Grid schedule={student.schedule||[]} onChange={()=>{}} readOnly/>
      </div>
    </div>
  );
}

/* ── 원생 폼 ── */
function StudentForm({init,teachers,onSave,onClose}) {
  const blank = {id:`s_${Date.now()}`,name:"",grade:GRADES[0],school:"",subject:SUBJECTS[0],textbooks:"",memo:"",teacherId:null,schedule:[],parentPhone:"",records:{}};
  const [f,sf] = useState(init||blank);
  const s = (k,v) => sf(p=>({...p,[k]:v}));
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <Sel label="담당 선생님" opts={[{v:"",l:"미배정"},...teachers.map(t=>({v:t.id,l:t.name}))]} value={f.teacherId||""} onChange={e=>s("teacherId",e.target.value||null)}/>
        <Inp label="학부모 연락처" value={f.parentPhone} onChange={e=>s("parentPhone",e.target.value)} placeholder="010-0000-0000"/>
      </div>
      <Inp label="교재" value={f.textbooks} onChange={e=>s("textbooks",e.target.value)} placeholder="교재명 (쉼표 구분)"/>
      <div style={{marginBottom:"0.85rem"}}>
        <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"3px",fontFamily:C.font}}>메모</div>
        <textarea value={f.memo} onChange={e=>s("memo",e.target.value)} rows={2} style={{width:"100%",background:"#0d1117",border:`1px solid ${C.border}`,borderRadius:"7px",padding:"7px 10px",color:C.text,fontSize:"0.875rem",outline:"none",boxSizing:"border-box",fontFamily:C.font,resize:"vertical"}}/>
      </div>
      <div style={{marginBottom:"0.85rem"}}>
        <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"6px",fontFamily:C.font}}>시간표 (30분 단위 클릭)</div>
        <Grid schedule={f.schedule||[]} onChange={v=>s("schedule",v)}/>
      </div>
      <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={onClose}>취소</Btn>
        <Btn onClick={()=>{if(!f.name.trim())return alert("이름을 입력하세요");onSave(f);onClose();}}>저장</Btn>
      </div>
    </div>
  );
}

/* ── 선생님 폼 ── */
function TeacherForm({init,onSave,onClose}) {
  const blank = {id:`t_${Date.now()}`,name:"",subject:SUBJECTS[0],color:TCOLORS[4]};
  const [f,sf] = useState(init||blank);
  const s = (k,v) => sf(p=>({...p,[k]:v}));
  return (
    <div>
      <Inp label="이름 *" value={f.name} onChange={e=>s("name",e.target.value)}/>
      <Sel label="담당 과목" opts={SUBJECTS} value={f.subject} onChange={e=>s("subject",e.target.value)}/>
      <div style={{marginBottom:"0.85rem"}}>
        <div style={{fontSize:"0.72rem",color:C.muted,marginBottom:"6px",fontFamily:C.font}}>대표 색상</div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {TCOLORS.map(c=><div key={c} onClick={()=>s("color",c)} style={{width:"28px",height:"28px",borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"3px solid #fff":"3px solid transparent"}}/>)}
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
export default function App() {
  const [user,setUser]         = useState(undefined);
  const [students,setStudents] = useState([]);
  const [teachers,setTeachers] = useState([]);
  const [tab,setTab]           = useState("schedule");
  const [schedView,setSchedView] = useState("full");
  const [tvId,setTvId]         = useState(null);
  const [selS,setSelS]         = useState(null);
  const [editS,setEditS]       = useState(null);
  const [addS,setAddS]         = useState(false);
  const [selT,setSelT]         = useState(null);
  const [editT,setEditT]       = useState(null);
  const [addT,setAddT]         = useState(false);
  const [showReport,setShowReport] = useState(false);
  const [search,setSearch]     = useState("");
  const [fT,setFT]             = useState("all");
  const [fSub,setFSub]         = useState("all");

  useEffect(()=>{
    return onAuthStateChanged(auth, u=>setUser(u||null));
  },[]);

  useEffect(()=>{
    if(!user) return;
    const u1 = onSnapshot(collection(db,"students"),snap=>setStudents(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(collection(db,"teachers"),snap=>setTeachers(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>{u1();u2();};
  },[user]);

  const saveStudent = async s => setDoc(doc(db,"students",s.id),s);
  const saveTeacher = async t => setDoc(doc(db,"teachers",t.id),t);
  const delStudent  = async id => { if(confirm("원생을 삭제할까요?")){ await deleteDoc(doc(db,"students",id)); setSelS(null); }};
  const delTeacher  = async id => {
    if(confirm("선생님을 삭제할까요?")){
      await deleteDoc(doc(db,"teachers",id));
      for(const s of students.filter(s=>s.teacherId===id)) await setDoc(doc(db,"students",s.id),{...s,teacherId:null});
      setSelT(null);
    }
  };
  const updateRecord = async (sid,date,rec) => {
    const s = students.find(x=>x.id===sid); if(!s) return;
    await setDoc(doc(db,"students",sid),{...s,records:{...(s.records||{}),[date]:rec}});
  };

  const filtered = students.filter(s=>{
    const q=search.toLowerCase();
    return(!q||s.name?.includes(q)||s.school?.toLowerCase().includes(q)||s.grade?.includes(q))&&(fT==="all"||s.teacherId===fT)&&(fSub==="all"||s.subject===fSub);
  });

  const td = today();
  const todayAtts = students.map(s=>s.records?.[td]?.att).filter(Boolean);
  const TABS = [{id:"schedule",l:"📅 시간표"},{id:"students",l:"👨‍🎓 원생"},{id:"teachers",l:"👩‍🏫 선생님"}];

  if(user===undefined) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:C.font,fontSize:"1rem"}}>
      로딩 중...
    </div>
  );

  if(!user) return <LoginScreen/>;

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:C.font}}>
      <header style={{background:C.card,borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:"1300px",margin:"0 auto",padding:"0 1.25rem",display:"flex",alignItems:"center",height:"54px",gap:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
            <div style={{width:"30px",height:"30px",borderRadius:"8px",background:"linear-gradient(135deg,#3b82f6,#06b6d4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem"}}>📐</div>
            <span style={{fontWeight:800,fontSize:"1rem",letterSpacing:"-0.02em"}}>봄 학원 관리</span>
          </div>
          <nav style={{display:"flex",gap:"3px"}}>
            {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{border:"none",borderRadius:"7px",padding:"5px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.82rem",background:tab===t.id?"#3b82f6":"transparent",color:tab===t.id?"#fff":C.muted}}>{t.l}</button>)}
          </nav>
          <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
            <Btn sm v="purple" onClick={()=>setShowReport(true)}>📊 레포트</Btn>
            <span style={{fontSize:"0.72rem",color:C.muted,fontFamily:C.font}}>👤 {user.email}</span>
            <button onClick={()=>signOut(auth)} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:"5px",padding:"3px 10px",color:C.muted,cursor:"pointer",fontSize:"0.72rem",fontFamily:C.font}}>로그아웃</button>
          </div>
        </div>
      </header>

      <main style={{maxWidth:"1300px",margin:"0 auto",padding:"1.25rem"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginBottom:"1.25rem"}}>
          {[
            {l:"전체 원생",v:`${students.length}명`,icon:"👨‍🎓",c:"#3b82f6"},
            {l:"선생님",v:`${teachers.length}명`,icon:"👩‍🏫",c:"#8b5cf6"},
            {l:"오늘 출석",v:`${todayAtts.filter(a=>a==="present").length}명`,icon:"✅",c:"#10b981"},
            {l:"오늘 결석",v:`${todayAtts.filter(a=>a==="absent").length}명`,icon:"❌",c:"#ef4444"},
          ].map(({l,v,icon,c})=>(
            <div key={l} style={{background:C.card,borderRadius:"10px",padding:"0.85rem 1rem",border:`1px solid ${C.border}`}}>
              <div style={{color:C.muted,fontSize:"0.68rem",marginBottom:"4px"}}>{l}</div>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}><span>{icon}</span><span style={{fontWeight:700,fontSize:"0.9rem",color:c}}>{v}</span></div>
            </div>
          ))}
        </div>

        {tab==="schedule"&&(
          <div style={{background:C.card,borderRadius:"12px",border:`1px solid ${C.border}`}}>
            <div style={{padding:"1rem 1.25rem",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
              <h2 style={{margin:0,fontSize:"0.95rem",fontWeight:700}}>📅 시간표 (30분 단위)</h2>
              <div style={{display:"flex",gap:"4px",background:"#0d1117",borderRadius:"8px",padding:"3px"}}>
                {[{id:"full",l:"전체"},{id:"byTeacher",l:"선생님별"}].map(sv=><button key={sv.id} onClick={()=>setSchedView(sv.id)} style={{border:"none",borderRadius:"6px",padding:"4px 12px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.76rem",background:schedView===sv.id?"#3b82f6":"transparent",color:schedView===sv.id?"#fff":C.muted}}>{sv.l}</button>)}
              </div>
            </div>
            <div style={{padding:"1rem 1.25rem"}}>
              {schedView==="full"&&<FullSched teachers={teachers} students={students}/>}
              {schedView==="byTeacher"&&(
                <div>
                  <div style={{display:"flex",gap:"6px",marginBottom:"1rem",flexWrap:"wrap"}}>
                    {teachers.map(t=><button key={t.id} onClick={()=>setTvId(t.id)} style={{border:`2px solid ${tvId===t.id?t.color:C.border}`,borderRadius:"8px",padding:"5px 14px",cursor:"pointer",fontFamily:C.font,fontWeight:600,fontSize:"0.8rem",background:tvId===t.id?t.color+"22":"transparent",color:tvId===t.id?t.color:C.muted}}>{t.name}</button>)}
                  </div>
                  {tvId?<TeacherSched teacher={teachers.find(x=>x.id===tvId)} students={students}/>:<div style={{color:C.muted,textAlign:"center",padding:"2rem",fontFamily:C.font}}>선생님을 선택하세요</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="students"&&(
          <div>
            <div style={{display:"flex",gap:"8px",marginBottom:"1rem",flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 이름·학교·학년 검색" style={{flex:1,minWidth:"150px",background:C.card,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"7px 12px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}/>
              <select value={fT} onChange={e=>setFT(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"7px 12px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
                <option value="all">전체 선생님</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select value={fSub} onChange={e=>setFSub(e.target.value)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"7px 12px",color:C.text,fontSize:"0.875rem",outline:"none",fontFamily:C.font}}>
                <option value="all">전체 과목</option>{SUBJECTS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <Btn onClick={()=>setAddS(true)}>+ 원생 추가</Btn>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(218px,1fr))",gap:"10px"}}>
              {filtered.map(st=>{
                const teacher=teachers.find(t=>t.id===st.teacherId);
                const tr=st.records?.[td]||{};
                return (
                  <div key={st.id} onClick={()=>setSelS(st)} style={{background:C.card,borderRadius:"11px",padding:"1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"border-color .15s,transform .15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=teacher?.color||"#3b82f6";e.currentTarget.style.transform="translateY(-2px)";}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="none";}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:teacher?.color||"#3b82f6"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"5px"}}>
                      <div><div style={{fontWeight:700,fontSize:"0.92rem"}}>{st.name}</div><div style={{color:C.muted,fontSize:"0.7rem"}}>{st.grade} · {st.school}</div></div>
                      {tr.att&&<Tag c={ATT_COLOR[tr.att]}>{ATT_LABEL[tr.att]}</Tag>}
                    </div>
                    <div style={{marginBottom:"5px",display:"flex",gap:"4px",flexWrap:"wrap"}}>
                      <Tag c={teacher?.color||"#3b82f6"}>{st.subject}</Tag>
                      {tr.hw&&<Tag c={HW_COLOR[tr.hw]}>숙제 {tr.hw.toUpperCase()}</Tag>}
                    </div>
                    <div style={{display:"flex",gap:"3px",flexWrap:"wrap"}}>
                      {(st.schedule||[]).slice(0,4).map((sc,i)=><span key={i} style={{fontSize:"0.62rem",padding:"2px 4px",borderRadius:"4px",background:"#0d1117",color:C.muted,fontFamily:C.font}}>{sc.day} {sc.time}</span>)}
                      {(st.schedule||[]).length>4&&<span style={{fontSize:"0.62rem",color:C.muted}}>+{st.schedule.length-4}</span>}
                    </div>
                    {teacher&&<div style={{marginTop:"5px",fontSize:"0.64rem",color:C.muted}}>👩‍🏫 {teacher.name}</div>}
                  </div>
                );
              })}
              {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",color:C.muted,padding:"3rem"}}>원생이 없습니다</div>}
            </div>
          </div>
        )}

        {tab==="teachers"&&(
          <div>
            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:"1rem"}}><Btn onClick={()=>setAddT(true)}>+ 선생님 추가</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(258px,1fr))",gap:"10px"}}>
              {teachers.map(t=>{
                const mine=students.filter(s=>s.teacherId===t.id);
                return (
                  <div key={t.id} onClick={()=>setSelT(t)} style={{background:C.card,borderRadius:"11px",padding:"1.1rem",border:`1px solid ${C.border}`,cursor:"pointer",position:"relative",overflow:"hidden",transition:"border-color .15s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.color} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"3px",background:t.color}}/>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                      <div style={{width:"36px",height:"36px",borderRadius:"50%",background:t.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:"0.95rem",flexShrink:0}}>{t.name[0]}</div>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:"0.92rem"}}>{t.name}</div><div style={{color:C.muted,fontSize:"0.7rem"}}>{t.subject}</div></div>
                      <div style={{fontWeight:700,fontSize:"0.95rem",color:t.color}}>{mine.length}명</div>
                    </div>
                    <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                      {mine.map(s=><Tag key={s.id} c={t.color}>{s.name}</Tag>)}
                      {mine.length===0&&<span style={{fontSize:"0.72rem",color:C.muted}}>담당 원생 없음</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {selS&&!editS&&(<Modal title={`${selS.name} 원생 상세`} onClose={()=>setSelS(null)} wide><StudentDetail student={students.find(s=>s.id===selS.id)||selS} teacher={teachers.find(t=>t.id===selS.teacherId)} onEdit={()=>setEditS(students.find(s=>s.id===selS.id))} onDelete={()=>delStudent(selS.id)} onUpdateRecord={updateRecord}/></Modal>)}
      {editS&&(<Modal title="원생 정보 수정" onClose={()=>setEditS(null)} wide><StudentForm init={editS} teachers={teachers} onSave={saveStudent} onClose={()=>{setEditS(null);setSelS(null);}}/></Modal>)}
      {addS&&(<Modal title="원생 추가" onClose={()=>setAddS(false)} wide><StudentForm teachers={teachers} onSave={saveStudent} onClose={()=>setAddS(false)}/></Modal>)}
      {selT&&!editT&&(<Modal title={`${selT.name} 시간표`} onClose={()=>setSelT(null)} wide><div style={{display:"flex",gap:"6px",marginBottom:"1rem"}}><Btn sm onClick={()=>setEditT(selT)}>✏️ 정보 수정</Btn><Btn sm v="danger" onClick={()=>delTeacher(selT.id)}>🗑️ 삭제</Btn></div><TeacherSched teacher={selT} students={students}/></Modal>)}
      {editT&&(<Modal title="선생님 정보 수정" onClose={()=>setEditT(null)}><TeacherForm init={editT} onSave={saveTeacher} onClose={()=>{setEditT(null);setSelT(null);}}/></Modal>)}
      {addT&&(<Modal title="선생님 추가" onClose={()=>setAddT(false)}><TeacherForm onSave={saveTeacher} onClose={()=>setAddT(false)}/></Modal>)}
      {showReport&&(<Modal title="📊 월별 출결·숙제 레포트" onClose={()=>setShowReport(false)} wide><ReportModal students={students}/></Modal>)}
    </div>
  );
}
