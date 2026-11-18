import React from 'react';

export default function PuashDeliveryMascot() {
  return (
    <svg className="puash-mascot" viewBox="0 0 360 390" role="img" aria-label="PUASH delivery character carrying a parcel">
      <defs>
        <linearGradient id="jacket" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#477a60"/><stop offset=".55" stopColor="#1d4a38"/><stop offset="1" stopColor="#123326"/></linearGradient>
        <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5c79e"/><stop offset="1" stopColor="#c9825e"/></linearGradient>
        <linearGradient id="box" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1c994"/><stop offset="1" stopColor="#c98d55"/></linearGradient>
        <linearGradient id="bag" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#47775d"/><stop offset="1" stopColor="#153b2c"/></linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="7"/></filter>
      </defs>
      <ellipse cx="182" cy="365" rx="108" ry="13" fill="#173c31" opacity=".15" filter="url(#shadow)"/>
      <!-- delivery backpack -->
      <path d="M73 151 Q66 120 91 108 L146 112 Q166 130 157 225 L87 238 Q67 220 73 151Z" fill="url(#bag)" stroke="#123326" strokeWidth="3"/>
      <path d="M85 132 Q111 113 143 131 L148 153 Q112 145 80 160Z" fill="#5d8b6d" opacity=".7"/>
      <path d="M94 165 Q113 154 136 166 L132 215 Q111 226 91 214Z" fill="#244e3a"/>
      <path d="M104 184h20l-3 24h-14Z" fill="#f4eedf" opacity=".95"/>
      <path d="M109 181q0-9 7-9t7 9" fill="none" stroke="#f4eedf" strokeWidth="3"/>
      <!-- legs -->
      <path d="M140 275 L194 278 L187 342 Q181 351 158 349 L146 344Z" fill="#e8e2d3"/>
      <path d="M197 276 L244 270 L260 337 Q250 350 228 347 L207 341Z" fill="#f4eee0"/>
      <path d="M146 337 Q167 343 190 336 L196 357 Q191 369 145 366 Q132 359 146 337Z" fill="#f8f4e9" stroke="#d4cbbb" strokeWidth="2"/>
      <path d="M222 334 Q243 341 261 333 L278 356 Q278 369 232 367 Q216 360 222 334Z" fill="#f8f4e9" stroke="#d4cbbb" strokeWidth="2"/>
      <path d="M149 354h35M235 355h34" stroke="#315b48" strokeWidth="4" strokeLinecap="round"/>
      <!-- torso -->
      <path d="M112 151 Q143 128 190 139 Q225 146 239 181 L248 284 Q207 304 135 292 L111 218Z" fill="url(#jacket)" stroke="#173c31" strokeWidth="3"/>
      <path d="M164 142 L184 143 L197 285 L169 290Z" fill="#6d9278" opacity=".55"/>
      <path d="M178 149v126" stroke="#d5c6a5" strokeWidth="3" opacity=".75"/>
      <path d="M134 213q20 12 38 0" fill="none" stroke="#86a58a" strokeWidth="3" opacity=".6"/>
      <path d="M206 205q17 7 27 0" fill="none" stroke="#86a58a" strokeWidth="3" opacity=".6"/>
      <!-- neck and head -->
      <path d="M157 111 L160 145 Q178 161 197 140 L190 107Z" fill="url(#skin)"/>
      <ellipse cx="179" cy="79" rx="43" ry="50" fill="url(#skin)"/>
      <path d="M137 77 Q130 32 171 26 Q211 20 223 60 Q209 47 197 47 Q172 62 141 53Z" fill="#292b25"/>
      <path d="M139 58 Q126 36 148 24 Q177 8 207 25 Q228 37 220 60 Q205 42 184 43 Q158 56 139 58Z" fill="#252923"/>
      <path d="M159 86q7 5 13 0M188 86q7 5 13 0" fill="none" stroke="#3b2b25" strokeWidth="3" strokeLinecap="round"/>
      <ellipse cx="166" cy="78" rx="3.4" ry="4.4" fill="#30251f"/><ellipse cx="196" cy="78" rx="3.4" ry="4.4" fill="#30251f"/>
      <path d="M175 91q5 4 10 0M166 104q13 12 27-1" fill="none" stroke="#8d4c3d" strokeWidth="3" strokeLinecap="round"/>
      <path d="M142 55 Q176 40 215 54 L213 68 Q176 55 143 70Z" fill="#173c31"/>
      <path d="M142 58 Q174 42 215 57" fill="none" stroke="#64866f" strokeWidth="4"/>
      <!-- arms -->
      <path d="M122 166 Q97 176 91 215 L127 244 Q145 226 150 202Z" fill="url(#jacket)"/>
      <path d="M224 166 Q250 165 266 193 L292 227 L267 251 Q243 236 220 207Z" fill="url(#jacket)"/>
      <path d="M91 213q-8 18 7 28l24 13q13 2 17-12l-24-27Z" fill="url(#skin)"/>
      <path d="M267 236q12-16 26-8l13 15q4 13-10 20l-25-9Z" fill="url(#skin)"/>
      <!-- parcel -->
      <path d="M111 220 L267 205 L319 239 L159 259Z" fill="#f2d5ad" stroke="#b47a4d" strokeWidth="2"/>
      <path d="M159 259 L319 239 L315 322 L156 341Z" fill="url(#box)" stroke="#a96f42" strokeWidth="2"/>
      <path d="M111 220 L159 259 L156 341 L106 298Z" fill="#d9a36e" stroke="#a96f42" strokeWidth="2"/>
      <path d="M208 211 L255 207 L258 331 L210 337Z" fill="#b76d4a" opacity=".88"/>
      <rect x="179" y="273" width="105" height="39" rx="8" fill="#f7f1e5" transform="rotate(-6 179 273)"/>
      <text x="232" y="298" textAnchor="middle" fontSize="17" fontWeight="800" letterSpacing="1.4" fill="#173c31" transform="rotate(-6 232 298)">PUASH</text>
      <!-- speed accents -->
      <path d="M34 178h28M23 194h36M40 210h22" stroke="#bd8258" strokeWidth="4" strokeLinecap="round" opacity=".8"/>
      <path d="M302 123l5 11 11 5-11 5-5 11-5-11-11-5 11-5Z" fill="#bd8258"/>
    </svg>
  );
}
