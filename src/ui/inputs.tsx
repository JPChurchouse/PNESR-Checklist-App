import { useState, type InputHTMLAttributes } from 'react'
import { moneyInputValue, parseMoney, parseWhole, type Cents } from '../domain/money'

type BaseProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>

/**
 * Text box for a number. Keeps exactly what was typed, stores the parsed value, and stores
 * null (not a guess) while the text isn't valid, showing an error instead.
 */
function NumberInput({
  value,
  onChange,
  parse,
  format,
  invalidMessage,
  className = '',
  ...rest
}: BaseProps & {
  value: number | null
  onChange: (value: number | null) => void
  parse: (text: string) => number | null
  format: (value: number | null) => string
  invalidMessage: string
}) {
  const [text, setText] = useState(() => format(value))
  const [seen, setSeen] = useState(value)
  const parsed = parse(text)
  const invalid = Number.isNaN(parsed)

  // The value was changed from outside (not by typing here): show the new value.
  if (value !== seen) {
    setSeen(value)
    if (!(parsed === value || (invalid && value === null))) setText(format(value))
  }

  return (
    <span className="number-input">
      <input
        {...rest}
        type="text"
        className={`${className} ${invalid ? 'invalid' : ''}`}
        value={text}
        aria-invalid={invalid}
        onChange={(e) => {
          setText(e.target.value)
          const next = parse(e.target.value)
          onChange(Number.isNaN(next) ? null : next)
        }}
        onBlur={() => !invalid && setText(format(value))}
      />
      {invalid && <span className="input-error">{invalidMessage}</span>}
    </span>
  )
}

export function MoneyInput(props: BaseProps & { value: Cents | null; onChange: (cents: Cents | null) => void }) {
  return (
    <span className="money-input">
      <span className="prefix" aria-hidden="true">
        $
      </span>
      <NumberInput {...props} inputMode="decimal" parse={parseMoney} format={moneyInputValue} invalidMessage="Not a valid amount" />
    </span>
  )
}

export function WholeInput(props: BaseProps & { value: number | null; onChange: (n: number | null) => void }) {
  return (
    <NumberInput
      {...props}
      inputMode="numeric"
      parse={parseWhole}
      format={(v) => (v === null ? '' : String(v))}
      invalidMessage="Whole numbers only"
    />
  )
}

/** A small colour chip for a ticket colour name like "Blue". Unknown names just show the text. */
export function ColourSwatch({ colour }: { colour: string }) {
  const known = typeof CSS !== 'undefined' && CSS.supports('color', colour.toLowerCase())
  return (
    <span className="colour">
      {known && <span className="swatch" style={{ background: colour.toLowerCase() }} aria-hidden="true" />}
      {colour}
    </span>
  )
}
