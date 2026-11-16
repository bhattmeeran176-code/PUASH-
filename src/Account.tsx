import { FormEvent, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle2, LogOut, ShieldCheck, UserRound } from 'lucide-react';

export default function Account() {
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProfile = async (current: any) => {
    setUser(current);
    if (current) {
      const { data, error: profileError } = await supabase
        .from('profiles').select('full_name').eq('id', current.id).maybeSingle();
      if (profileError) setError('Profile load nahi hua: ' + profileError.message);
      const name = data?.full_name || current.user_metadata?.full_name || '';
      setFullName(name);
      setSavedName(name);
    }
    setReady(true);
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) loadProfile(data.session?.user ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive) window.setTimeout(() => { if (alive) loadProfile(session?.user ?? null); }, 0);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: 'https://puash.pages.dev/'
          }
        });
    setBusy(false);
    if (result.error) setError(result.error.message);
    else if (mode === 'signup' && !result.data.session) setMessage('Account ban gaya! Apna email inbox check karke confirmation link par tap karein. Phir yahan sign in karein.');
    else setMessage(mode === 'signup' ? 'Account create ho gaya.' : 'Welcome back!');
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setError(''); setMessage('');
    const { error: saveError } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setBusy(false);
    if (saveError) setError('Profile save nahi hua: ' + saveError.message);
    else { setSavedName(fullName.trim()); setMessage('Profile update ho gaya.'); }
  };

  if (!ready) return <div className="account-screen"><div className="account-card">PUASH account load ho raha hai…</div></div>;

  return <div className="account-screen">
    <section className="account-card">
      <a className="account-back" href="/"><ArrowLeft size={16}/> PUASH store par wapas</a>
      <div className="account-brand">PUASH<span>.</span><small>YOUR ACCOUNT</small></div>
      <div className="account-icon">{user ? <UserRound size={26}/> : <ShieldCheck size={26}/>}</div>
      {!user ? <>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        <p>{mode === 'login' ? 'Sign in karke apna PUASH shopping account access karein.' : 'PUASH par apna customer account banayein.'}</p>
        <form className="account-form" onSubmit={authenticate}>
          {mode === 'signup' && <label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" required placeholder="Your name"/></label>}
          <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com"/></label>
          <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required placeholder="At least 8 characters"/></label>
          <button className="account-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="account-switch" onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login');setMessage('');setError('')}}>
          {mode === 'login' ? 'New to PUASH? Create an account' : 'Already have an account? Sign in'}
        </button>
      </> : <>
        <h1>My account.</h1>
        <p>Welcome to PUASH. Yahan apni basic profile details update kar sakte hain.</p>
        <div className="account-email"><small>Signed in as</small><strong>{user.email}</strong></div>
        <form className="account-form" onSubmit={saveProfile}>
          <label>Full name<input value={fullName} onChange={e=>setFullName(e.target.value)} autoComplete="name" placeholder="Your name"/></label>
          <button className="account-primary" disabled={busy || fullName.trim() === savedName}>{busy ? 'Saving…' : 'Save profile'}</button>
        </form>
        <button className="account-signout" onClick={()=>supabase.auth.signOut()}><LogOut size={16}/> Sign out</button>
      </>}
      {message && <div className="account-message"><CheckCircle2 size={16}/>{message}</div>}
      {error && <div className="account-error">{error}</div>}
    </section>
  </div>;
}
