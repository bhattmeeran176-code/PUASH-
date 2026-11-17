import { FormEvent, useState } from 'react';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { supabase } from './supabase';

type Props = { user: any };

export default function PhoneLinkCard({ user }: Props) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const normalizePhone = (value: string) => {
    const raw = value.trim();
    const digits = raw.replace(/\D/g, '');
    return raw.startsWith('+') ? '+' + digits : digits.length === 10 ? '+91' + digits : '';
  };

  const requestLinkOtp = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError('Valid mobile number enter karein. India ke liye 10-digit number bhi chalega.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
    setBusy(false);
    if (updateError) setError('Phone link OTP request nahi hui: ' + updateError.message);
    else {
      setPhone(normalized);
      setOtp('');
      setSent(true);
      setMessage('Verification code aapke mobile par bheja gaya hai.');
    }
  };

  const verifyLinkOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('6-digit OTP enter karein.');
      return;
    }
    setBusy(true); setError(''); setMessage('');
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp.trim(),
      type: 'phone_change',
    });
    setBusy(false);
    if (verifyError) setError('Phone verify nahi hua: ' + verifyError.message);
    else {
      setSent(false);
      setOtp('');
      setMessage('Phone number aapke existing PUASH account ke saath link aur verify ho gaya.');
    }
  };

  const verified = Boolean(user?.phone && user?.phone_confirmed_at);

  return <section className="account-notifications phone-link-card">
    <div className="address-book-heading">
      <div><Smartphone size={18}/><strong>Mobile number</strong></div>
      {verified && <span className="customer-order-count">Verified</span>}
    </div>
    <p className="address-hint">{verified ? 'Aapka verified mobile number isi account ke saath linked hai.' : 'Apne existing account ke saath mobile number link karein. Aapke orders aur account history isi account mein rahenge.'}</p>
    {verified ? <div className="account-email"><small>Verified number</small><strong>{user.phone}</strong></div> : <>
      {!sent ? <form className="account-form" onSubmit={requestLinkOtp}>
        <label>Mobile number<input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+91 98765 43210" required/></label>
        <button className="account-primary" disabled={busy}>{busy ? 'Sending code…' : 'Link mobile number'}</button>
      </form> : <form className="account-form" onSubmit={verifyLinkOtp}>
        <label>6-digit verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={event=>setOtp(event.target.value.replace(/\D/g,'').slice(0,6))} maxLength={6} pattern="[0-9]{6}" required placeholder="Enter OTP"/></label>
        <p className="account-auth-note">Code sent to {phone}. Is code ko verify karne se number isi signed-in account mein add hoga.</p>
        <button className="account-primary" disabled={busy}>{busy ? 'Verifying…' : 'Verify and link number'}</button>
        <button type="button" className="account-switch" disabled={busy} onClick={()=>{setSent(false);setOtp('');setError('');setMessage('');}}>Change number</button>
      </form>}
    </>}
    {message && <div className="account-message"><CheckCircle2 size={16}/>{message}</div>}
    {error && <div className="account-error">{error}</div>}
  </section>;
}
