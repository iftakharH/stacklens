import { languageColor } from '../lib/languages';

export type LanguageShare = { language: string; percentage: number };

/**
 * The spectrum: the product's core reading, set as a band of ink with
 * graduations and a printed scale. Every patch prints its own name and number,
 * so the reading is never carried by colour alone.
 */
export const LanguageBar: React.FC<{
  items: LanguageShare[];
  height?: number;
  legend?: boolean;
  /** Graduations drawn over the band, every 10%. */
  scaled?: boolean;
  /** Printed scale direction. `scale` adds a per-language graduated rule. */
  legendLayout?: 'row' | 'column' | 'scale';
}> = ({
  items,
  height = 22,
  legend = true,
  scaled = true,
  legendLayout = 'row',
}) => {
  const visible = items.filter((item) => item.percentage > 0.05);
  const spoken = visible
    .map((item) => `${item.language} ${item.percentage}%`)
    .join(', ');

  return (
    <div>
      <div
        className={`patch-strip ${scaled ? 'patch-strip--scaled' : ''}`}
        style={{ height }}
        role="img"
        aria-label={`Language mix: ${spoken}`}
      >
        {visible.map((item, index) => (
          <span
            key={item.language}
            className="patch grow-x"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: languageColor(item.language),
              animationDelay: `${index * 70}ms`,
            }}
          />
        ))}
      </div>

      {legend && (
        <ul
          className={
            legendLayout === 'row'
              ? 'mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1.5'
              : 'ledger mt-4 border-t border-line'
          }
        >
          {visible.map((item) => (
            <li
              key={item.language}
              className={
                legendLayout === 'row'
                  ? 'flex items-center gap-2'
                  : 'py-2.5'
              }
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="block h-2.5 w-2.5 shrink-0"
                  style={{ backgroundColor: languageColor(item.language) }}
                />
                <span className="text-[13px] font-medium text-ink">
                  {item.language}
                </span>
                <span className="num ml-auto text-[11px] text-muted">
                  {item.percentage}%
                </span>
              </div>
              {legendLayout === 'scale' && (
                <div
                  className="relative mt-2 h-[3px] w-full bg-line"
                  aria-hidden="true"
                >
                  <span
                    className="absolute inset-y-0 left-0 grow-x"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: languageColor(item.language),
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageBar;
