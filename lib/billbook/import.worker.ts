import { readImportFile, type ImportRow } from './import';

export type ImportResult = { rows: ImportRow[] } | { error: string };
const scope = self as unknown as {
  onmessage: (event: MessageEvent<File>) => void;
  postMessage: (result: ImportResult) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    scope.postMessage({ rows: await readImportFile(data) });
  } catch (error) {
    scope.postMessage({ error: (error as Error).message });
  }
};
