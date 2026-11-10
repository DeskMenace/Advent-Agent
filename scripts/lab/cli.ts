/** Developer-only gift lab (never shipped): npm run lab -- <plan-season|make-gift|simulate-season|report> [flags]. */
const [cmd, ...rest] = process.argv.slice(2);
const run = async (): Promise<number> => {
  switch (cmd) {
    case 'plan-season': return (await import('./plan-season.js')).planSeason(rest);
    case 'make-gift': return (await import('./make-gift.js')).makeGift(rest);
    case 'list-check': return (await import('./list-check.js')).listCheck(rest);
    case 'simulate-season': return (await import('./simulate-season.js')).simulateSeason(rest);
    case 'invalid-gift': return (await import('./invalid-gift.js')).invalidGift(rest);
    case 'keepsake': return (await import('./keepsake.js')).keepsake(rest);
    case 'open-calendar': return (await import('./keepsake.js')).openCalendar(rest);
    case 'report': return (await import('./report.js')).report(rest);
    case 'compare': return (await import('./compare.js')).compare(rest);
    default:
      console.error('Usage: npm run lab -- plan-season --harness cc|codex --model <m> --run <n>\n       npm run lab -- make-gift --idea <id> | --free --harness cc|codex --model <m> [--day N]\n       npm run lab -- simulate-season --harness cc|codex --model <m> --messy\n       npm run lab -- report [--serve]\n       npm run lab -- keepsake [--to <folder>]\n       npm run lab -- open-calendar [--home <dir>] [--port 4980]');
      return 2;
  }
};
run().then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
