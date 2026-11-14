// Kartu bergambar bentuk SVG buatan sendiri: tampil sama di semua device (tidak seperti emoji).
const COLORS = ["var(--pink)", "var(--sun)", "var(--mint)", "var(--sky)", "var(--violet)"];
const WHITE = { fill: "var(--white)" };
const INK = { fill: "var(--ink)" };
const NONE = { fill: "none" };

const SHAPES = {
  bintang: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  hati: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  bulan: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  matahari: (
    <>
      <path d="M12 1v2M12 21v2M1 12h2M21 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M19.8 4.2l-1.4 1.4M4.2 19.8l1.4-1.4" style={NONE} />
      <circle cx="12" cy="12" r="5.5" />
    </>
  ),
  petir: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  awan: <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />,
  tetes: <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />,
  berlian: <polygon points="12 2 22 12 12 22 2 12" />,
  segitiga: <polygon points="12 3 22 20 2 20" />,
  bunga: (
    <>
      <circle cx="18.5" cy="12" r="4.2" />
      <circle cx="14.01" cy="18.18" r="4.2" />
      <circle cx="6.74" cy="15.82" r="4.2" />
      <circle cx="6.74" cy="8.18" r="4.2" />
      <circle cx="14.01" cy="5.82" r="4.2" />
      <circle cx="12" cy="12" r="3" style={WHITE} />
    </>
  ),
  mahkota: <polygon points="3 19 3 8 8.5 12.5 12 5 15.5 12.5 21 8 21 19" />,
  segienam: <polygon points="12 2 21 7 21 17 12 22 3 17 3 7" />,
  daun: (
    <>
      <path d="M5 20C4 11 9 4 20 4c1 11-5 16-15 16z" />
      <path d="M5 20 12 13" style={NONE} />
    </>
  ),
  senyum: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="1" style={INK} />
      <circle cx="15" cy="10" r="1" style={INK} />
      <path d="M8 14.5c1 2 2.5 3 4 3s3-1 4-3" style={NONE} />
    </>
  ),
  tambah: <polygon points="9 3 15 3 15 9 21 9 21 15 15 15 15 21 9 21 9 15 3 15 3 9 9 9" />,
  cincin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" style={WHITE} />
    </>
  ),
  persegi: <rect x="4" y="4" width="16" height="16" rx="3" />,
  mata: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3.2" style={WHITE} />
    </>
  ),
  obrolan: <path d="M4 4h16v12h-8l-4 4v-4H4z" />,
  gunung: <polygon points="2 20 9 8 13 14 16 10 22 20" />,
};

export const SHAPE_IDS = Object.keys(SHAPES);

export function Shape({ id, className }) {
  const color = COLORS[SHAPE_IDS.indexOf(id) % COLORS.length];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g
        style={{ fill: color, stroke: "var(--ink)" }}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {SHAPES[id]}
      </g>
    </svg>
  );
}