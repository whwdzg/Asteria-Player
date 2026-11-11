import type { FontChoice } from './types';

export const FONT_STACKS: Record<FontChoice, string> = {
  display: '"Segoe UI Variable Display", "Segoe UI", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif',
  sans: '"Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", "Songti SC", "Noto Serif SC", "SimSun", serif',
  rounded: '"Segoe UI Variable Display", "Yu Gothic UI", "Microsoft YaHei UI", "PingFang SC", system-ui, sans-serif',
  mono: '"Cascadia Code", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

export function fontStack(choice: FontChoice): string {
  return FONT_STACKS[choice] ?? FONT_STACKS.sans;
}
