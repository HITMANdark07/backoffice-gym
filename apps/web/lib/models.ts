const NAMES: Record<string, string> = {
  'minimax/minimax-m3.1-flash:free': 'MiniMax M3.1 Flash',
  'nvidia/nemotron-3-ultra-550b-a55b:free': 'Nemotron 3 Ultra',
};

export const modelLabel = (id: string): string => NAMES[id] ?? id.replace(/^[^/]+\//, '').replace(/:free$/, '');
