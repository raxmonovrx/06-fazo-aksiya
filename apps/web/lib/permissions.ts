/**
 * Panel ruxsatlari — apps/api/src/admin/permissions.ts bilan bir xil
 * (API haqiqiy tekshiruvni qiladi, bu yerda faqat ko'rinish uchun).
 */
export type Permission =
  | 'dashboard'
  | 'cashier'
  | 'vouchers'
  | 'vouchers.cancel'
  | 'participants'
  | 'participants.edit'
  | 'branches'
  | 'staff'
  | 'export'
  | 'settings'
  | 'users';

export type AdminRole = 'ADMIN' | 'OPERATOR' | 'MANAGER' | 'CASHIER';

/** Formada guruhlab ko'rsatish uchun */
export const PERMISSION_GROUPS: Array<{
  title: string;
  items: Array<{ value: Permission; label: string; hint: string }>;
}> = [
  {
    title: 'Kassa',
    items: [
      { value: 'cashier', label: 'Kassa', hint: "Mijozga QR chiqaradi, o'zi chiqarganini bekor qiladi" },
      { value: 'vouchers', label: 'Vaucherlar', hint: 'Barcha QR ro\'yxati (filialga biriktirilgan bo\'lsa — o\'z filiali)' },
      { value: 'vouchers.cancel', label: 'Boshqalarning QR\'ini bekor qilish', hint: 'Boshqa kassirlar chiqargan QR\'ni bekor qiladi va qayta chop etadi' },
    ],
  },
  {
    title: 'Mijozlar',
    items: [
      { value: 'dashboard', label: 'Dashboard', hint: 'Umumiy statistika' },
      { value: 'participants', label: 'Ishtirokchilar', hint: "Ro'yxat va kuponlar" },
      { value: 'participants.edit', label: 'Ishtirokchini bloklash', hint: "Bloklash va xodim deb belgilash" },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { value: 'branches', label: 'Filiallar va kassalar', hint: 'Kupon qoidasi, chek ko\'rinishi, terminallar' },
      { value: 'staff', label: 'Xodimlar ro\'yxati', hint: "Aksiyada qatnasha olmaydigan raqamlar" },
      { value: 'export', label: 'Eksport', hint: 'Excel yuklab olish' },
      { value: 'settings', label: 'Aksiya sozlamalari', hint: 'Sana, qoidalar matni' },
      { value: 'users', label: 'Foydalanuvchilar', hint: 'Panelga kirish va ruxsatlarni boshqarish' },
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.value));

export const ROLES: Array<{ value: AdminRole; label: string; description: string; template: Permission[]; needsBranch: boolean }> = [
  {
    value: 'CASHIER',
    label: 'Kassir',
    description: "Faqat Kassa: o'z filialida mijozga QR chiqaradi",
    template: ['cashier'],
    needsBranch: true,
  },
  {
    value: 'MANAGER',
    label: 'Filial menejeri',
    description: "O'z filialining kassasi va barcha QR'lari",
    template: ['cashier', 'vouchers', 'vouchers.cancel'],
    needsBranch: true,
  },
  {
    value: 'OPERATOR',
    label: 'Operator',
    description: 'Dashboard, vaucherlar va ishtirokchilar',
    template: ['dashboard', 'vouchers', 'participants'],
    needsBranch: false,
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    description: "To'liq kirish — hamma bo'lim va filiallar",
    template: ALL_PERMISSIONS,
    needsBranch: false,
  },
];

export const roleInfo = (r: AdminRole) => ROLES.find((x) => x.value === r) ?? ROLES[0];
export const roleLabel = (r: AdminRole) => roleInfo(r).label;
