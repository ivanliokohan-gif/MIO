import{IMPORT_LIMITS,buildImportPreview,createTask,parseImport}from"./logic.js";
const $=s=>document.querySelector(s),PRIO={high:"Importante",normal:"Normal",low:"Cuando pueda"};
const LABEL={ok:"",duplicate:"Posible duplicado",invalid:"Con errores"};
let preview=[];
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function showStep(step){$("#importInput").hidden=step!=="input";$("#importPreview").hidden=step!=="preview"}
function setError(msg){const n=$("#importError");n.textContent=msg||"";n.hidden=!msg}
function updateCount(){const n=preview.filter(p=>p.selected).length,b=$("#importConfirm");b.disabled=!n;b.textContent=n?`Importar ${n} ${n===1?"tarea":"tareas"}`:"Selecciona tareas";const c=preview.filter(p=>p.status==="ok").length,d=preview.filter(p=>p.status==="duplicate").length,i=preview.filter(p=>p.status==="invalid").length;$("#importSummary").textContent=`${c} válidas · ${d} posibles duplicadas · ${i} con errores`}
function renderPreview(){const box=$("#importList");box.replaceChildren();preview.forEach((p,idx)=>{const row=el("label",`import-item ${p.status}`),cb=el("input");cb.type="checkbox";cb.className="check";cb.checked=p.selected;cb.disabled=p.status==="invalid";cb.onchange=()=>{p.selected=cb.checked;updateCount()};const copy=el("div","copy");if(p.task){copy.append(el("strong","",p.task.title));const meta=[p.task.date,p.task.time,PRIO[p.task.priority],p.task.notes].filter(Boolean).join(" · ");if(meta)copy.append(el("small","",meta))}else copy.append(el("strong","",p.source),el("small","",p.errors.join(" · ")));if(LABEL[p.status])copy.append(el("em","badge",LABEL[p.status]));row.append(cb,copy);box.append(row)});updateCount()}
function analyze(text,getTasks){setError("");let entries;try{entries=parseImport(text)}catch(e){setError(e.message);return}if(!entries.length){setError("No encontré tareas para importar.");return}preview=buildImportPreview(entries,getTasks());renderPreview();showStep("preview")}
export function initImporter({getTasks,addTasks,toast}){
const dlg=$("#importDialog"),area=$("#importText"),file=$("#importFile");
const reset=()=>{area.value="";file.value="";preview=[];setError("");showStep("input")};
$("#openImport").onclick=()=>{reset();dlg.showModal()};
$("#closeImport").onclick=()=>dlg.close();
$("#importAnalyze").onclick=()=>analyze(area.value,getTasks);
$("#importBack").onclick=()=>{showStep("input");setError("")};
file.onchange=async()=>{const f=file.files&&file.files[0];if(!f)return;if(f.size>IMPORT_LIMITS.maxBytes){setError("El archivo es demasiado grande (máximo 1 MB).");file.value="";return}try{analyze(await f.text(),getTasks)}catch{setError("No pude leer el archivo.")}file.value=""};
$("#importAll").onclick=()=>{preview.forEach(p=>{if(p.status!=="invalid")p.selected=true});renderPreview()};
$("#importNone").onclick=()=>{preview.forEach(p=>p.selected=false);renderPreview()};
$("#importConfirm").onclick=()=>{const chosen=preview.filter(p=>p.selected),now=Date.now();if(!chosen.length)return;const made=chosen.map((p,i)=>createTask(p.task,now+i));addTasks(made);dlg.close();toast(`${made.length} ${made.length===1?"tarea importada":"tareas importadas"}`)}}
