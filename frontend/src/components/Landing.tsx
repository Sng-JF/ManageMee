import React, { useEffect, useState } from 'react';
// import logo from '../assets/managemee-logo.png';
import logo from '../assets/managemee-logo.png';
//   import { registerUser } from '../services/auth';
import { loginUser, registerUser } from '../services/auth';
import IPhoneFrame from './IPhoneFrame';

const CSS = `
:root{
--brand:#fb6b18;
--brand-dark:#e55f15;
--text:#343434;
--muted:#898989;
--border:#cbcbcb;
--surface:#ffffff;
--bg:#f4f4f4;
--chip-bg:#fff4ec;
--shadow:0 18px 45px rgba(52,52,52,0.08);
--radius-lg:20px;
--radius-md:15px;
--radius-sm:10px
}
*{box-sizing:border-box}
body{margin:0}

.phone-shell{
width:min(100%,430px);
min-height:980px;
background:var(--surface);
border-radius:28px;
box-shadow:var(--shadow);
overflow:hidden;
position:relative
}

.auth-card-shell{
height:100%;
min-height:100%;
display:flex;
flex-direction:column;
overflow:hidden
}

.header{
background:var(--brand);
color:#fff;
padding:32px 28px 26px
}

.eyebrow{
margin:0 0 10px;
font-size:12px;
letter-spacing:.12em;
text-transform:uppercase;
opacity:.88;
font-weight:700
}

.header h1{
margin:0;
font-size:34px;
line-height:1.1;
font-weight:700
}

.progress-wrap{
padding:20px 28px 0;
background:var(--surface)
}

.progress-meta{
display:flex;
align-items:center;
justify-content:space-between;
gap:16px;
margin-bottom:10px;
font-size:13px;
color:var(--muted);
font-weight:600
}

.progress-track{
width:100%;
height:8px;
background:#f0f0f0;
border-radius:999px;
overflow:hidden
}

.progress-bar{
height:100%;
width:16.66%;
background:var(--brand);
border-radius:inherit;
transition:width .25s ease
}

.content{
padding:22px 28px 40px;
flex:1;
min-height:0;
overflow-y:auto;
-webkit-overflow-scrolling:touch;
/* Hide native scrollbars but keep scrolling functional */
scrollbar-width: none; /* Firefox */
-ms-overflow-style: none; /* IE 10+ */
}

/* WebKit-based browsers (Chrome, Edge, Safari) */
.content::-webkit-scrollbar{
width:0;
height:0;
}

#signupForm,
#loginForm{
display:flex;
flex-direction:column
}

.step{
display:none;
animation:fade .22s ease
}

.step.active{
display:flex;
flex-direction:column;
}

@keyframes fade{
from{opacity:0;transform:translateY(6px)}
to{opacity:1;transform:translateY(0)}
}

.step h2{
margin:0 0 8px;
font-size:27px;
line-height:1.2;
font-weight:700
}

.step .subtext{
margin:0 0 26px;
font-size:14px;
line-height:1.6;
color:var(--muted)
}

.field{margin-bottom:16px}

.field label{
display:block;
margin-bottom:8px;
font-size:14px;
font-weight:700;
color:var(--text)
}

.field input,
.field textarea{
width:100%;
border:1px solid var(--border);
border-radius:var(--radius-sm);
padding:16px;
font-size:16px;
color:var(--text);
background:#fff;
outline:none;
transition:border-color .15s ease,box-shadow .15s ease;
font-family:inherit
}

.field input{height:68px}

.field textarea{
min-height:108px;
resize:vertical
}

.field input::placeholder,
.field textarea::placeholder{
color:var(--muted)
}

.field input:focus,
.field textarea:focus{
border-color:var(--brand);
box-shadow:0 0 0 4px rgba(251,107,24,0.12)
}

.hint{
display:block;
margin-top:8px;
color:var(--muted);
font-size:12px;
line-height:1.5
}

.actions{
display:flex;
gap:12px;
margin-top:auto;
padding-top:24px;
padding-bottom:6px;
position:sticky;
bottom:0;
background:linear-gradient(180deg,rgba(255,255,255,0) 0%, #ffffff 22%, #ffffff 100%)
}

.btn{
height:48px;
border-radius:15px;
font-size:16px;
font-weight:700;
padding:0 22px;
cursor:pointer;
border:1.5px solid transparent;
transition:background-color .15s ease,color .15s ease,border-color .15s ease,transform .12s ease
}

.btn:active{transform:scale(.985)}

.btn-primary{
flex:1;
background:var(--brand);
color:#fff;
border-color:var(--brand)
}

.btn-primary:hover{background:var(--brand-dark)}

.btn-secondary{
min-width:108px;
background:#fff;
color:var(--text);
border-color:var(--border)
}

.btn-secondary:hover{
border-color:var(--brand);
color:var(--brand)
}

.toggle-row{
display:grid;
grid-template-columns:1fr 1fr;
gap:10px;
margin:2px 0 18px
}

.toggle-btn{
min-height:48px;
border-radius:14px;
padding:0 14px;
font-size:14px;
font-weight:700;
background:#fff;
color:var(--text);
border:1.5px solid var(--border);
cursor:pointer;
transition:all .15s ease
}

.toggle-btn.active{
border-color:var(--brand);
background:var(--chip-bg);
color:var(--brand)
}

.location-panel{display:none}
.location-panel.active{display:block}

.map-card{
border-radius:18px;
border:1px solid rgba(251,107,24,.18);
background:linear-gradient(180deg,#fff7f1 0%,#ffffff 100%);
padding:16px
}

.map-visual{
position:relative;
height:190px;
overflow:hidden;
border-radius:16px;
border:1px solid rgba(251,107,24,.15);
background:
linear-gradient(90deg,rgba(255,255,255,.85) 1px,transparent 1px),
linear-gradient(rgba(255,255,255,.85) 1px,transparent 1px),
linear-gradient(135deg,#fde8d8 0%,#fff7f1 50%,#ffe9da 100%);
background-size:28px 28px,28px 28px,auto;
margin-bottom:14px
}

.map-road{
position:absolute;
border-radius:999px;
background:rgba(52,52,52,.10)
}

.map-pin{
position:absolute;
width:18px;
height:18px;
border:none;
border-radius:999px;
background:var(--brand);
box-shadow:0 6px 14px rgba(251,107,24,.22);
cursor:pointer
}

.map-pin.active{
transform:scale(1.1);
box-shadow:0 8px 18px rgba(251,107,24,.26)
}

.map-tag{
position:absolute;
top:-34px;
left:50%;
transform:translateX(-50%);
white-space:nowrap;
border-radius:999px;
border:1px solid rgba(251,107,24,.20);
background:#fff;
padding:6px 10px;
font-size:11px;
font-weight:700;
color:var(--text);
box-shadow:0 6px 14px rgba(52,52,52,.08)
}

.map-selected{
border:1px solid #eee;
border-radius:14px;
background:#fff;
padding:12px 14px;
font-size:14px;
color:var(--text)
}

.chip-grid{
display:grid;
grid-template-columns:repeat(2,minmax(0,1fr));
gap:12px;
margin-top:6px
}

.chip{
width:100%;
min-height:48px;
border-radius:999px;
border:1.5px solid var(--border);
padding:0 16px;
background:#fff;
color:var(--text);
font-size:15px;
font-weight:700;
cursor:pointer;
transition:all .15s ease
}

.chip.selected{
border-color:var(--brand);
background:var(--chip-bg);
color:var(--brand);
box-shadow:0 8px 18px rgba(251,107,24,.12)
}

.selected-count{
margin-top:16px;
font-size:13px;
font-weight:700;
color:var(--brand)
}

.custom-card{
margin-top:18px;
border-radius:18px;
border:1px solid rgba(251,107,24,.20);
background:linear-gradient(180deg,#fff7f1 0%,#ffffff 100%);
padding:16px
}

.custom-card h3{
margin:0 0 10px;
font-size:16px;
font-weight:700;
color:var(--text)
}

.custom-row{
display:flex;
gap:10px;
align-items:stretch
}

.custom-row input{
flex:1;
height:52px;
border:1px solid var(--border);
border-radius:12px;
padding:0 14px;
font-size:15px;
color:var(--text);
outline:none
}

.custom-row input:focus{
border-color:var(--brand);
box-shadow:0 0 0 4px rgba(251,107,24,.10)
}

.custom-add{
min-width:94px;
border:none;
border-radius:12px;
background:var(--brand);
color:#fff;
font-size:14px;
font-weight:700;
cursor:pointer
}

.custom-add:disabled{
opacity:.5;
cursor:not-allowed
}

.success-card{
padding:24px;
border-radius:var(--radius-lg);
background:linear-gradient(180deg,#fff7f1 0%,#ffffff 100%);
border:1px solid rgba(251,107,24,.18)
}

.success-badge{
width:56px;
height:56px;
border-radius:50%;
display:inline-flex;
align-items:center;
justify-content:center;
background:rgba(251,107,24,.12);
color:var(--brand);
font-size:28px;
font-weight:800;
margin-bottom:14px
}

.summary-list{
margin:18px 0 0;
padding:0;
list-style:none;
display:grid;
gap:12px
}

.summary-list li{
padding:14px 16px;
border:1px solid #eee;
border-radius:14px;
background:#fff;
font-size:14px;
line-height:1.5
}

.summary-label{
display:block;
color:var(--muted);
font-size:12px;
font-weight:700;
text-transform:uppercase;
letter-spacing:.06em;
margin-bottom:4px
}

.footer-note{
margin-top:18px;
font-size:12px;
line-height:1.5;
color:var(--muted);
text-align:center
}

.landing-view{
    flex:1;
    padding:20px 20px 16px;
    position:relative;
    display:flex;
    flex-direction:column;
    overflow:visible;
}

.landing-stack{
flex:1;
display:flex;
flex-direction:column;
align-items:center;
position:relative;
z-index:1
}

.landing-brand{
margin-top:20px;
display:flex;
flex-direction:column;
align-items:center;
text-align:center
}

.landing-logo{
width:512px;
height:192px;
border-radius:36px;
background:transparent;
box-shadow:none;
display:grid;
place-items:center;
}

.landing-title{
margin:28px 0 10px;
font-size:40px;
line-height:1.05;
font-weight:800;
color:var(--text);
letter-spacing:-.03em
}

.landing-copy{
margin:0;
max-width:300px;
font-size:16px;
line-height:1.65;
color:var(--muted)
}

.landing-actions{
width:100%;
margin-top:auto;
display:grid;
gap:14px;
padding-bottom:32px
}

.landing-btn{
width:100%;
height:52px;
border-radius:999px;
font-size:16px;
font-weight:800;
cursor:pointer;
transition:transform .12s ease,background-color .15s ease,color .15s ease,border-color .15s ease
}

.landing-btn-primary{
border:none;
background:var(--brand);
color:#fff
}

.landing-btn-primary:hover{background:var(--brand-dark)}

.landing-btn-secondary{
border:1.5px solid var(--border);
background:#fff;
color:var(--text)
}

.landing-btn-secondary:hover{
border-color:var(--brand);
color:var(--brand)
}

@media(max-width:480px){
.phone-shell{
width:100%;
min-height:100vh;
border-radius:0
}

.landing-stack{
min-height:calc(100vh - 68px)
}

.header h1{font-size:30px}
.step h2{font-size:24px}
.custom-row{flex-direction:column}
}
`;

const DEFAULT_MENU = [
'Rice Dishes', 'Noodles', 'Beverages', 'Desserts', 'Breakfast', 'Snacks', 'Vegetarian', 'Seafood', 'Spicy', 'Local Favourites'
];

const DEFAULT_INGREDIENTS = [
'Meat & Poultry', 'Seafood', 'Vegetables', 'Noodles & Pasta', 'Rice & Grains', 'Spices & Seasonings', 'Sauces & Condiments', 'Dairy & Eggs', 'Beverage Supplies', 'Packaging'
];

export default function Landing({ onLogin }: { onLogin: () => void }) {
const [view, setView] = useState<'landing' | 'login' | 'signup'>('landing');
const [step, setStep] = useState(0);
const steps = 7;

// Signup form
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [name, setName] = useState('');
const [stallName, setStallName] = useState('');
const [locationMode, setLocationMode] = useState<'map'|'manual'>('map');
const [selectedMapLocation, setSelectedMapLocation] = useState('');
const [manualAddress, setManualAddress] = useState('');
const [menuSelected, setMenuSelected] = useState<string[]>([]);
const [ingredientSelected, setIngredientSelected] = useState<string[]>([]);
const [menuCustom, setMenuCustom] = useState('');
const [ingredientCustom, setIngredientCustom] = useState('');

const [authError, setAuthError] = useState('');
const [isSubmitting, setIsSubmitting] = useState(false);

const allMenuOptions = Array.from(new Set([...DEFAULT_MENU, ...menuSelected]));
const allIngredientOptions = Array.from(new Set([...DEFAULT_INGREDIENTS, ...ingredientSelected]));
const locationSummary =
  locationMode === 'map' ? selectedMapLocation : manualAddress.trim();

useEffect(() => { /* no-op */ }, []);

function next() {
    if (!validateStep(step)) return;
    setStep(s => Math.min(s + 1, steps - 1));
}

function back() {
    setStep(s => Math.max(s - 1, 0));
}

function validateStep(i: number) {
    if (i === 0) return !!email && email.includes('@');
    if (i === 1) return password.length >= 8;
    if (i === 2) return name.trim().length > 0;
    if (i === 3) {
    if (!stallName.trim()) return false;
    if (locationMode === 'map') return !!selectedMapLocation;
    return manualAddress.trim().length > 0;
    }
    return true;
}

function toggleSelection(value: string, list: string[], setList: (s: string[]) => void) {
    if (list.includes(value)) setList(list.filter(x => x !== value));
    else setList([...list, value]);
}

async function handleCreateAccount(e?: React.FormEvent) {
  e?.preventDefault();
  setAuthError('');

  if (!validateStep(step)) return;

  try {
    setIsSubmitting(true);

    await registerUser({
      email,
      password,
      name,
      stallName,
      location: locationSummary,
      stallCategories: menuSelected,
      ingredientCategories: ingredientSelected,
    });

    onLogin();
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Failed to create account.');
  } finally {
    setIsSubmitting(false);
  }
}

async function handleLoginSubmit(e?: React.FormEvent) {
  e?.preventDefault();
  setAuthError('');

  try {
    setIsSubmitting(true);

    await loginUser({
      email,
      password,
    });

    onLogin();
  } catch (error) {
    setAuthError(error instanceof Error ? error.message : 'Failed to log in.');
  } finally {
    setIsSubmitting(false);
  }
}

return (
    <IPhoneFrame>
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <style>{CSS}</style>

        {view === 'landing' && (
        <section className="landing-view">
            <div className="landing-stack">
            <div className="landing-brand">
                <div className="landing-logo" aria-hidden="true">
                    <img src={logo} alt="ManageMee" style={{ width: 192, height: 192, objectFit: 'contain' }} />
                </div>
                <h1 className="landing-title">ManageMee</h1>
                <p className="landing-copy">Run your stall smarter. Track sales, ingredients, suppliers, and prep in one place.</p>
            </div>

            <div className="landing-actions">
                <button className="landing-btn landing-btn-primary" onClick={() => { setView('login'); }}>
                Login
                </button>
                <button className="landing-btn landing-btn-secondary" onClick={() => { setView('signup'); setStep(0); }}>
                Sign Up
                </button>
            </div>
            </div>
        </section>
        )}

        {view === 'login' && (
        <section className="auth-card-shell">
            <header className="header">
            <p className="eyebrow">ManageMee account</p>
            <h1>Welcome back</h1>
            </header>
            <section className="content">
            <form id="loginForm" onSubmit={handleLoginSubmit}>
                <div className="step active">
                <h2>Log in to your account</h2>
                {/* <p className="subtext">This is a frontend-only placeholder login screen for the landing page flow.</p> */}
                {authError && (
                <p style={{ color: '#dc2626', margin: '0 0 16px', fontSize: 14, lineHeight: 1.5 }}>
                    {authError}
                </p>
                )}

                <div className="field">
                    <label htmlFor="loginEmail">Email address</label>
                    <input id="loginEmail" name="loginEmail" type="email" placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>

                <div className="field">
                    <label htmlFor="loginPassword">Password</label>
                    <input id="loginPassword" name="loginPassword" type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>

                <div className="actions">
                    <button className="btn btn-secondary" type="button" onClick={() => setView('landing')}>Back</button>
                    <button className="btn btn-primary" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Logging in...' : 'Login'}
                    </button>
                </div>
                </div>
            </form>
            </section>
        </section>
        )}

        {view === 'signup' && (
        <section className="auth-card-shell">
            <header className="header">
            <p className="eyebrow">ManageMee account</p>
            <h1>Create your account</h1>
            </header>

            <section className="progress-wrap">
            <div className="progress-meta">
                <span>Step {Math.min(step+1, steps)} of {steps}</span>
                <span>{['Email','Password','Name','Stall','Menu categories','Ingredients','Review'][step]}</span>
            </div>
            <div className="progress-track"><div className="progress-bar" style={{ width: `${((step+1)/steps)*100}%` }} /></div>
            </section>

            <section className="content">
            <form id="signupForm" onSubmit={handleCreateAccount}>
                <div className={`step ${step===0?'active':''}`}>
                <h2>What's your email?</h2>
                {/* <p className="subtext">Use the email address you want to sign in with.</p> */}
                <div className="field">
                    <label htmlFor="email">Email address</label>
                    <input id="email" name="email" type="email" placeholder="name@example.com" value={email} onChange={e=>setEmail(e.target.value)} required />
                    <span className="hint">We'll use this for sign-in, password resets, and important account updates.</span>
                </div>
                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setView('landing')}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===1?'active':''}`}>
                <h2>Create a password</h2>
                {/* <p className="subtext">Choose something secure that you'll remember.</p> */}
                <div className="field">
                    <label htmlFor="password">Password</label>
                    <input id="password" name="password" type="password" placeholder="At least 8 characters" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} />
                    <span className="hint">Tip: combine letters, numbers, and symbols for better security.</span>
                </div>
                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===2?'active':''}`}>
                <h2>What should we call you?</h2>
                {/* <p className="subtext">This is the name shown in your account profile.</p> */}
                <div className="field">
                    <label htmlFor="name">Your name</label>
                    <input id="name" name="name" type="text" placeholder="Enter your name" value={name} onChange={e=>setName(e.target.value)} required />
                    <span className="hint">You can use your full name or preferred name.</span>
                </div>
                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===3?'active':''}`}>
                <h2>Tell us about your stall</h2>
                {/* <p className="subtext">Add your stall name and choose a location either from the map or by entering the address manually.</p> */}

                <div className="field">
                    <label htmlFor="stallName">Stall name</label>
                    <input id="stallName" name="stallName" type="text" placeholder="Example: Ah Meng Chicken Rice" value={stallName} onChange={e=>setStallName(e.target.value)} required />
                </div>

                <div className="toggle-row" role="tablist" aria-label="Location entry method">
                    <button type="button" className={`toggle-btn ${locationMode==='map'?'active':''}`} onClick={()=>setLocationMode('map')}>Pick from map</button>
                    <button type="button" className={`toggle-btn ${locationMode==='manual'?'active':''}`} onClick={()=>setLocationMode('manual')}>Enter address manually</button>
                </div>

                <div className={`location-panel ${locationMode==='map'?'active':''}`}>
                    <div className="map-card">
                    <div className="map-visual" aria-label="Map location picker">
                        <div className="map-road road-1" style={{top:26,left:-18,width:210,height:18,transform:'rotate(18deg)'}} />
                        <div className="map-road road-2" style={{top:98,right:-24,width:210,height:16,transform:'rotate(-12deg)'}} />
                        <div className="map-road road-3" style={{top:12,right:70,width:18,height:180}} />

                        <button type="button" className={`map-pin ${selectedMapLocation==='Maxwell Food Centre, Singapore'?'active':''}`} style={{top:42,left:58}} onClick={()=>setSelectedMapLocation('Maxwell Food Centre, Singapore')}><span className="map-tag">Maxwell</span></button>
                        <button type="button" className={`map-pin ${selectedMapLocation==='Lau Pa Sat, Singapore'?'active':''}`} style={{top:86,left:184}} onClick={()=>setSelectedMapLocation('Lau Pa Sat, Singapore')}><span className="map-tag">Lau Pa Sat</span></button>
                        <button type="button" className={`map-pin ${selectedMapLocation==='Old Airport Road Food Centre, Singapore'?'active':''}`} style={{top:128,left:108}} onClick={()=>setSelectedMapLocation('Old Airport Road Food Centre, Singapore')}><span className="map-tag">Old Airport</span></button>
                    </div>
                    <div className="map-selected">{selectedMapLocation ? `Selected location: ${selectedMapLocation}` : 'No map location selected yet.'}</div>
                    <span className="hint">This is a frontend prototype map picker. You can later swap it with a real map integration.</span>
                    </div>
                </div>

                <div className={`location-panel ${locationMode==='manual'?'active':''}`}>
                    <div className="field">
                    <label htmlFor="manualAddress">Stall address</label>
                    <textarea id="manualAddress" name="manualAddress" placeholder="Enter your stall address" value={manualAddress} onChange={e=>setManualAddress(e.target.value)} />
                    <span className="hint">Example: 18 Raffles Quay, #B1-12, Singapore 048582</span>
                    </div>
                </div>

                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===4?'active':''}`}>
                <h2>Choose your stall categories</h2>
                {/* <p className="subtext">Select any number of menu categories that fit your stall. Add a custom one if none of these fit well.</p> */}
                <div className="chip-grid">
                    {allMenuOptions.map(m => (
                    <button key={m} type="button" className={`chip ${menuSelected.includes(m)?'selected':''}`} onClick={()=>toggleSelection(m, menuSelected, setMenuSelected)}>{m}</button>
                    ))}
                </div>
                <div className="selected-count">{menuSelected.length} selected</div>

                <div className="custom-card">
                    <h3>Add a custom stall category</h3>
                    <p className="subtext" style={{margin:0,marginBottom:12}}>For example: Muslim-friendly, Western Grill, Fusion, or Seasonal Specials.</p>
                    <div className="custom-row">
                    <input value={menuCustom} onChange={e=>setMenuCustom(e.target.value)} placeholder="Enter custom stall category" />
                    <button type="button" className="custom-add" onClick={() => { if(menuCustom.trim()){ if(!menuSelected.includes(menuCustom.trim())) setMenuSelected([...menuSelected, menuCustom.trim()]); setMenuCustom(''); } }}>Add</button>
                    </div>
                </div>

                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===5?'active':''}`}>
                <h2>Select ingredient categories</h2>
                {/* <p className="subtext">Pick the ingredient groups your stall is likely to use. You can choose any number here too.</p> */}
                <div className="chip-grid">
                    {allIngredientOptions.map(m => (
                    <button key={m} type="button" className={`chip ${ingredientSelected.includes(m)?'selected':''}`} onClick={()=>toggleSelection(m, ingredientSelected, setIngredientSelected)}>{m}</button>
                    ))}
                </div>
                <div className="selected-count">{ingredientSelected.length} selected</div>

                <div className="custom-card">
                    <h3>Add a custom ingredient category</h3>
                    <p className="subtext" style={{margin:0,marginBottom:12}}>For example: Frozen Goods, Herbal Ingredients, Baking Supplies, or Imported Items.</p>
                    <div className="custom-row">
                    <input value={ingredientCustom} onChange={e=>setIngredientCustom(e.target.value)} placeholder="Enter custom ingredient category" />
                    <button type="button" className="custom-add" onClick={() => { if(ingredientCustom.trim()){ if(!ingredientSelected.includes(ingredientCustom.trim())) setIngredientSelected([...ingredientSelected, ingredientCustom.trim()]); setIngredientCustom(''); } }}>Add</button>
                    </div>
                </div>

                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>Back</button>
                    <button type="button" className="btn btn-primary" onClick={next}>Next</button>
                </div>
                </div>

                <div className={`step ${step===6?'active':''}`}>
                <h2>Review your details</h2>
                {/* <p className="subtext">Double-check everything before creating your account.</p> */}

                <div className="success-card">
                    {/* <div className="success-badge">✓</div> */}

                    <ul className="summary-list">
                    <li>
                        <span className="summary-label">Email</span>
                        {email}
                    </li>

                    <li>
                        <span className="summary-label">Name</span>
                        {name}
                    </li>

                    <li>
                        <span className="summary-label">Stall name</span>
                        {stallName}
                    </li>

                    <li>
                        <span className="summary-label">Location</span>
                        {locationSummary || 'No location selected'}
                    </li>

                    <li>
                        <span className="summary-label">Stall categories</span>
                        {menuSelected.length > 0 ? menuSelected.join(', ') : 'None selected'}
                    </li>

                    <li>
                        <span className="summary-label">Ingredient categories</span>
                        {ingredientSelected.length > 0 ? ingredientSelected.join(', ') : 'None selected'}
                    </li>
                    </ul>

                    <p className="footer-note">
                    {/* You can go back to make changes before continuing. */}
                    </p>
                </div>

                <div className="actions">
                    <button type="button" className="btn btn-secondary" onClick={back}>
                    Back
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating Account...' : 'Create Account'}
                    </button>
                </div>
                </div>
            </form>

            <section id="successStep" style={{display:'none'}}>
                {/* kept for parity with prototype; we auto-login after create */}
            </section>
            </section>
            </section>
        )}
    </div>
    </IPhoneFrame>
);
}
