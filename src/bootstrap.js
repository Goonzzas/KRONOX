// Keep this entry free of static dependencies so a failed React import can be reported.
import('./main.jsx')
  .then(() => window.__kronoxStartup?.ready())
  .catch((error) => window.__kronoxStartup?.fail(error));
