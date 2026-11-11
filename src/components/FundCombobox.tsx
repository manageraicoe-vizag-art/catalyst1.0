import { Check, Plus } from 'lucide-react'
import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { cn, normFund } from '../lib/utils'
import { Input } from './ui'

/**
 * Fund picker: suggests participating funds and funds teammates already entered,
 * and lets an investor add a new one (saved on registration for the next teammate).
 */
export function FundCombobox({
  id,
  value,
  onChange,
  options,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const q = normFund(value)
  const exact = options.find((o) => normFund(o) === q)
  const matches = useMemo(() => {
    const list = q ? options.filter((o) => normFund(o).includes(q)) : options
    return [...list]
      .sort((a, b) => Number(normFund(b).startsWith(q)) - Number(normFund(a).startsWith(q)) || a.localeCompare(b))
      .slice(0, 8)
  }, [options, q])
  const showAdd = !!q && !exact
  const items: Array<{ kind: 'fund' | 'add'; label: string }> = [
    ...matches.map((m) => ({ kind: 'fund' as const, label: m })),
    ...(showAdd ? [{ kind: 'add' as const, label: value.trim().replace(/\s+/g, ' ') }] : []),
  ]

  const choose = (i: number) => {
    const it = items[i]
    if (!it) return
    onChange(it.label)
    setOpen(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open && items.length) {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="words"
        value={value}
        placeholder="Start typing your fund"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setActive(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-300 bg-slate-100 py-1 shadow-xl shadow-black/60"
        >
          {items.map((it, i) => (
            <li
              key={it.kind + it.label}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(i)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[15px]',
                i === active ? 'bg-slate-200 text-slate-950' : 'text-slate-800',
                it.kind === 'add' && 'border-t border-slate-300 text-brand-800',
              )}
            >
              {it.kind === 'add' ? (
                <>
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="min-w-0 truncate">
                    Add “<strong>{it.label}</strong>” as a new fund
                  </span>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{it.label}</span>
                  {normFund(it.label) === q && <Check className="h-4 w-4 shrink-0 text-go" aria-hidden />}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
