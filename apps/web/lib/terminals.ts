import { RiPrinterLine, RiSmartphoneLine, type RemixiconComponentType } from '@remixicon/react';

export type TerminalOutput = 'PRINT_80' | 'PRINT_58' | 'SCREEN';

export interface Terminal {
  id: number;
  branchId: number;
  name: string;
  output: TerminalOutput;
  isActive: boolean;
  sortOrder: number;
}

export const OUTPUTS: Record<TerminalOutput, { label: string; short: string; icon: RemixiconComponentType }> = {
  PRINT_80: { label: 'Printer 80 mm', short: 'Chop etish · 80 mm', icon: RiPrinterLine },
  PRINT_58: { label: 'Printer 58 mm', short: 'Chop etish · 58 mm', icon: RiPrinterLine },
  SCREEN: { label: "Ekranda ko'rsatish", short: 'Ekranda', icon: RiSmartphoneLine },
};
