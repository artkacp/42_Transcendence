import type { ComponentProps } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { pageItems } from './paginationItems'

/*
 * (◕◕) Pagination — page switcher under a list: ‹ 1 … 4 [5] 6 … 12 ›
 *
 * Draws the buttons and reports the click; the page that owns the list
 * decides what is on each page (Browse: 6 pets per page, UI-3.1) and resets
 * to page 1 when a filter changes (UI-3.5).
 *
 * Built on Button, so focus, hover and disabled styles follow the rest of
 * the design system automatically.
 */

export interface PaginationProps
  extends Omit<ComponentProps<'nav'>, 'onChange'> {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  onChange,
  className = '',
  ...rest
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const current = Math.min(Math.max(1, page), totalPages);

  return (
    <nav
      aria-label="Pagination"
      className={`flex items-center justify-center gap-1 ${className}`}
      {...rest}
    >
      <Button
        variant="ghost"
        size="sm"
        aria-label="Previous page"
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        icon={<ChevronLeft size={16} />}
      />

      {pageItems(current, totalPages).map((item, i) =>
        item === 'gap' ? (
          <span
            key={`gap-${i}`}
            aria-hidden="true"
            className="px-1 text-xs text-text-subtle"
          >
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === current ? 'primary' : 'ghost'}
            size="sm"
            className="min-w-8"
            aria-label={`Page ${item}`}
            aria-current={item === current ? 'page' : undefined}
            onClick={() => item !== current && onChange(item)}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="ghost"
        size="sm"
        aria-label="Next page"
        disabled={current === totalPages}
        onClick={() => onChange(current + 1)}
        icon={<ChevronRight size={16} />}
      />
    </nav>
  );
}