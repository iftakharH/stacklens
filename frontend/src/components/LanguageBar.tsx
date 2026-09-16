import { languageColor } from '../lib/languages';

export type LanguageShare = { language: string; percentage: number };

// A language fingerprint: GitHub's own language colours, sized by real share.
// The bar is the product's core output, so it stays legible at a glance and the
// legend carries the exact percentages for anyone who wants the numbers.
export const LanguageBar: React.FC<{
  items: LanguageShare[];
  height?: number;
  legend?: boolean;
}> = ({ items, height = 20, legend = true }) => {
  const visible = items.filter((item) => item.percentage > 0.05);
  const spoken = visible
    .map((item) => `${item.language} ${item.percentage}%`)
    .join(', ');

  return (
    <div>
      <div
        role="img"
        aria-label={`Language mix: ${spoken}`}
        className="flex w-full overflow-hidden rounded-[3px]"
        style={{ height }}
      >
        {visible.map((item) => (
          <span
            key={item.language}
            className="h-full"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: languageColor(item.language),
            }}
          />
        ))}
      </div>

      {legend && (
        <ul className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1.5">
          {visible.map((item) => (
            <li
              key={item.language}
              className="flex items-center gap-1.5 text-[13px]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: languageColor(item.language) }}
              />
              <span className="text-ink">{item.language}</span>
              <span className="font-mono text-[11px] tabular-nums text-muted">
                {item.percentage}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default LanguageBar;
