import './kashmir-delivery-scene.css';

export default function KashmirDeliveryScene() {
  return (
    <div className="kashmir-scene" role="img" aria-label="Animated Kashmir valley with mountains, a lake house and a PUASH delivery rider">
      <svg viewBox="0 0 420 470" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#bde4f1"/><stop offset="1" stopColor="#f7f4e8"/></linearGradient>
          <linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#70b9c2"/><stop offset="1" stopColor="#347f86"/></linearGradient>
          <linearGradient id="hills" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#719b73"/><stop offset="1" stopColor="#245b45"/></linearGradient>
          <linearGradient id="road" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#8b918b"/><stop offset="1" stopColor="#59645f"/></linearGradient>
        </defs>
        <rect width="420" height="470" fill="url(#sky)"/>
        <g className="scene-clouds" fill="#fff" opacity=".78"><ellipse cx="83" cy="82" rx="65" ry="17"/><ellipse cx="117" cy="74" rx="36" ry="20"/><ellipse cx="330" cy="111" rx="58" ry="14"/></g>
        <path d="M0 237L75 127l31 44 57-92 68 107 52-68 62 85 45-48 30 39v94H0Z" fill="#a8c9d1"/>
        <path d="M106 171l57-92 25 39-16-8-10 15-12-5-14 20-13-3Z M231 186l52-68 29 40-18-8-12 12-12-6-14 15Z M0 237l75-110 20 28-16-5-11 13-12-4-19 29Z" fill="#fffdf5"/>
        <path d="M0 239q70-43 132-6t138-5q79-42 150 9v76H0Z" fill="url(#hills)"/>
        <path d="M0 275q83-31 153-4t142-7q65-23 125 2v73H0Z" fill="#477d57"/>
        <g fill="#194d3b">
          <path d="M24 253l18-48 18 48h-10l17 29H17l17-29Z M64 262l14-39 15 39h-9l13 24H58l13-24Z M357 249l19-52 20 52h-11l17 29h-51l17-29Z M323 263l14-41 15 41h-9l13 24h-37l13-24Z"/>
        </g>
        <path d="M0 291q95-16 186 1t234-2v94H0Z" fill="url(#water)"/>
        <g className="scene-water" stroke="#d4f1e8" strokeWidth="2" opacity=".65" fill="none"><path d="M15 313q35-6 69 0t70 0M207 331q41-7 82 0t87 0M36 356q48-5 96 0M244 366q37-6 75 0"/></g>
        <g className="scene-house">
          <path d="M273 267l66-42 68 43v72H273Z" fill="#b97845" stroke="#805536" strokeWidth="3"/>
          <path d="M263 270l76-55 78 54-10 8-68-44-67 45Z" fill="#394d43"/>
          <path d="M279 275h119v9H279Z" fill="#f0c27f"/>
          <path d="M289 289h17v25h-17zM325 289h18v25h-18zM364 289h17v25h-17z" fill="#e9d4a8"/>
          <path d="M314 315h32v24h-32z" fill="#493c31"/>
          <path d="M273 339h146" stroke="#e2bd82" strokeWidth="5"/>
        </g>
        <path d="M0 372q111-17 212 1t208-2v99H0Z" fill="url(#road)"/>
        <path d="M0 377q111-17 212 1t208-2" fill="none" stroke="#d6d8ca" strokeWidth="5"/>
        <g className="road-dashes" stroke="#f6f2df" strokeWidth="5" strokeLinecap="round"><path d="M32 425h39M145 428h40M275 425h39M377 423h30"/></g>
        <g className="scene-leaves" fill="#2e7048"><path d="M0 0q50 5 71 53Q32 42 0 64Z M0 27q38 5 48 42Q20 59 0 82Z"/><path d="M420 0q-41 8-52 52 34-10 52 12Z"/></g>
        <g className="delivery-rider">
          <ellipse cx="115" cy="432" rx="79" ry="8" fill="#233f35" opacity=".25"/>
          <circle cx="67" cy="406" r="24" fill="#263a34" stroke="#e5e9db" strokeWidth="5"/>
          <circle cx="67" cy="406" r="8" fill="#bdc9bb"/>
          <circle cx="177" cy="406" r="24" fill="#263a34" stroke="#e5e9db" strokeWidth="5"/>
          <circle cx="177" cy="406" r="8" fill="#bdc9bb"/>
          <path d="M68 395q30-35 75-24l30 22-16 17H78Z" fill="#1b634b" stroke="#174333" strokeWidth="4"/>
          <path d="M119 365l-8-36q-2-13 11-17l25 4q14 6 12 22l-3 31Z" fill="#287b59"/>
          <path d="M112 321l-1-17q12-25 36-10l8 23Z" fill="#f0bd92"/>
          <path d="M105 303q-1-31 26-34 29 1 30 31l-12 4-10-17-26 17Z" fill="#244d3d"/>
          <path d="M113 296q24-22 46-4" fill="none" stroke="#f1f3e9" strokeWidth="4"/>
          <path d="M126 351l36 36M137 350l-35 34" stroke="#e9b78e" strokeWidth="10" strokeLinecap="round"/>
          <path d="M155 342l23-14 18 8-16 12-19 7Z" fill="#e5a45f"/>
          <path d="M146 342l-10-28 36-18 25 25-21 21Z" fill="#e9b66d" stroke="#a96e3e" strokeWidth="3"/>
          <path d="M150 332l28-22" stroke="#fff0d4" strokeWidth="4"/>
          <path d="M89 375l-15 29M160 380l17 26" stroke="#1b634b" strokeWidth="7" strokeLinecap="round"/>
        </g>
      </svg>
    </div>
  );
}
