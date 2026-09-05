import { DRAFT_ORDER, TOOL_USERS } from '../data';

export function SeatPicker({ value, onChange, allSeats = false }: { value: number; onChange: (seat: number) => void; allSeats?: boolean }) {
  return <div className="seat-picker" role="group" aria-label="Draft seat">
    {TOOL_USERS.map(([name, seat]) => <button key={seat} type="button" aria-pressed={value === seat} className={`seat-option ${value === seat ? 'selected' : ''}`} onClick={() => onChange(seat)}><span className="seat-number">{seat}</span><span>{name}<small>Pick {seat}</small></span></button>)}
    {allSeats && <label className="other-seat"><span>Other seat</span><select aria-label="My draft slot" value={value} onChange={e => onChange(Number(e.target.value))}><option value={0}>Choose…</option>{DRAFT_ORDER.map((name, i) => <option key={name} value={i + 1}>{i + 1} · {name}</option>)}</select></label>}
  </div>;
}
