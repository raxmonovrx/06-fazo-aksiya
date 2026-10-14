"use client"

import { useState, type CSSProperties, type MouseEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { RiArrowRightSLine } from "@remixicon/react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAdmin } from "@/app/admin/(panel)/admin-context"
import { activeItemIndex, inSection, sectionsFor, type NavSection } from "@/components/nav-tree"
import { cn } from "@/lib/utils"

/**
 * restobrain superadmin `nav-main.tsx` dan 1:1 ko'chirilgan. Farqi:
 * bo'limlar rolga ko'ra (`sectionsFor`), Dashboard faqat aniq moslikda yonadi.
 *
 * Asosiy navigatsiya — shadcn `sidebar-07` bloki: har bo'lim akkordeon,
 * lekin bir vaqtda FAQAT BITTASI ochiq (egasining talabi, 2026-09-29):
 * boshqasi ochilsa oldingisi yopiladi. Aks holda bir necha bo'lim
 * ochilib, ro'yxat ekrandan chiqib ketardi.
 *
 * Blok `defaultOpen={item.isActive}` ishlatadi, chunki undagi `isActive`
 * qo'lda yozilgan o'zgarmas ma'lumot. Bizda u `pathname` dan kelib
 * chiqadi va sahifa almashganda o'zgaradi — nazoratsiz Collapsible esa
 * `defaultOpen` ni faqat birinchi renderda o'qiydi va keyin o'zgargani
 * uchun Base UI ogohlantirish beradi. Shuning uchun ochiq bo'lim shu
 * yerda saqlanadi.
 *
 * Ochiq bo'lim FAQAT joriy bo'lim almashganda unga o'tadi, har pathname
 * o'zgarishida emas: operator ochiq bo'limni yopib qo'ygan bo'lsa, o'sha
 * bo'lim ichida sahifadan sahifaga yurganda u qayta ochilib, qo'lidan
 * olib qo'yilmaydi.
 */
export function NavMain() {
  const sections = sectionsFor(useAdmin())
  const pathname = usePathname()
  // Ikonkagacha yig'ilgan sidebar (telefonda emas — u yerda to'liq panel ochiladi)
  const { state, isMobile, setOpenMobile } = useSidebar()
  const collapsed = state === "collapsed" && !isMobile

  // Bosilgan havola — navigatsiya tugashini kutmasdan faol deb ko'rsatiladi.
  // O'lchangan: bosishdan `pathname` almashguncha ~240ms (dev) — shu vaqt
  // davomida kontent allaqachon yangi, sidebar esa eski holatda qotib
  // turardi va keyin sakrardi. Manzil almashganda haqiqiy qiymat oladi.
  const [pendingUrl, setPendingUrl] = useState<string>()
  const [seenPathname, setSeenPathname] = useState(pathname)
  if (seenPathname !== pathname) {
    setSeenPathname(pathname)
    setPendingUrl(undefined)
  }
  const current = pendingUrl ?? pathname
  const navigate = (url: string) => (event: MouseEvent) => {
    // Yangi oyna/tabda ochish — joriy sahifa o'zgarmaydi
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    setPendingUrl(url)
    // Telefonda sidebar — ustki varaq: yopilmasa yangi sahifa uning ostida qolardi
    if (isMobile) setOpenMobile(false)
  }

  const activeUrl = sections.find((section) => inSection(current, section.url))?.url
  const [openSection, setOpenSection] = useState<string | undefined>(activeUrl)
  // Render paytida moslash — React'ning "prop o'zgarganda holatni
  // to'g'rilash" naqshi. Effekt ichida setState qilinsa React kadrni
  // avval ochilmagan holda chizib, keyin qayta chizardi (va React
  // Compiler qoidasi buni taqiqlaydi ham).
  const [seenActiveUrl, setSeenActiveUrl] = useState(activeUrl)
  if (seenActiveUrl !== activeUrl) {
    setSeenActiveUrl(activeUrl)
    setOpenSection(activeUrl)
  }

  return (
    <SidebarGroup>
      {/* Blokda bandlar orasi 0 va balandligi 32px — 10 ta bo'lim bir-biriga
          yopishib turardi. 36px + 4px oraliq. */}
      <SidebarMenu className="gap-1">
        {sections.map((section) => {
          const Icon = section.icon
          const active = inSection(current, section.url)

          // Ichki sahifasi yo'q bo'lim (Monitoring, Davomat…) akkordeon
          // emas — ochiladigan hech narsasi yo'q, oddiy havola bo'ladi.
          if (!section.items?.length) {
            return (
              <SidebarMenuItem key={section.url}>
                <SidebarMenuButton
                  tooltip={section.title}
                  isActive={active}
                  className={SECTION_BUTTON}
                  render={<Link href={section.url} onClick={navigate(section.url)} />}
                >
                  <Icon />
                  <span className="truncate">{section.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          const activeIndex = activeItemIndex(section.items, current)
          // Yig'ilganda akkordeon ochilmaydi (ichki ro'yxatga joy yo'q) —
          // ichki sahifalar o'ngda suzuvchi menyuda (egasi, 2026-10-07)
          if (collapsed) {
            return (
              <SidebarMenuItem key={section.url}>
                <CollapsedSection section={section} active={active} activeIndex={activeIndex} navigate={navigate} />
              </SidebarMenuItem>
            )
          }
          return (
            <Collapsible
              key={section.url}
              open={openSection === section.url}
              onOpenChange={(next) => setOpenSection(next ? section.url : undefined)}
              className="group/collapsible"
              render={<SidebarMenuItem />}
            >
              <CollapsibleTrigger
                render={
                  <SidebarMenuButton
                    tooltip={section.title}
                    // Yig'ilgan (ikonka) holatda submenyu ko'rinmaydi —
                    // joriy bo'limni faqat shu belgi ko'rsatadi.
                    isActive={active}
                    className={SECTION_BUTTON}
                  />
                }
              >
                <Icon />
                <span className="truncate">{section.title}</span>
                <RiArrowRightSLine className={CHEVRON} />
              </CollapsibleTrigger>
              <CollapsibleContent className={PANEL}>
                <SectionTree items={section.items} activeIndex={activeIndex} navigate={navigate} />
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * Yig'ilgan sidebar'dagi bo'lim: ikonka ustiga sichqoncha borsa (yoki
 * bosilsa — sensorli ekran, klaviatura) o'ngda ichki sahifalar menyusi
 * chiqadi. Egasi (2026-10-07): «ichki sahifasi bor bo'limni bossam
 * ochilmaydi» — yig'ilgan holatda akkordeonning ochiladigan joyi yo'q edi.
 *
 * Base UI Menu: `openOnHover` — sichqoncha ikonkadan menyuga o'tayotganda
 * («xavfsiz yo'lak») menyu yopilmaydi; band — haqiqiy `<a>` (Ctrl/⌘ +
 * bosish yangi tabda ochadi), klaviatura bilan ↑↓ va Enter ishlaydi,
 * Esc yopadi. Bosilgach menyu yopiladi.
 *
 * Tooltip qo'yilmaydi: menyu sarlavhasi bo'lim nomini o'zi aytadi, ikkalasi
 * bir vaqtda chiqsa ustma-ust tushardi.
 */
function CollapsedSection({
  section,
  active,
  activeIndex,
  navigate,
}: {
  section: NavSection
  active: boolean
  activeIndex: number
  navigate: (url: string) => (event: MouseEvent) => void
}) {
  const Icon = section.icon
  const items = section.items ?? []
  return (
    <MenuPrimitive.Root>
      <MenuPrimitive.Trigger
        openOnHover
        // Tez o'tib ketayotgan sichqoncha har ikonkada menyu ochmasin;
        // yopilish — menyuga yetib olguncha bir oz kutadi
        delay={80}
        closeDelay={150}
        aria-label={section.title}
        render={<SidebarMenuButton isActive={active} className={SECTION_BUTTON} />}
      >
        <Icon />
        <span className="truncate">{section.title}</span>
      </MenuPrimitive.Trigger>
      <MenuPrimitive.Portal>
        <MenuPrimitive.Positioner className="isolate z-50 outline-none" side="right" align="start" sideOffset={10} alignOffset={-4}>
          <MenuPrimitive.Popup className={FLYOUT}>
            <div className="flex items-center gap-2 px-2 pt-1.5 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {section.title}
            </div>
            {items.map((item, index) => {
              const ItemIcon = item.icon
              const current = index === activeIndex
              return (
                <MenuPrimitive.LinkItem
                  key={item.url}
                  closeOnClick
                  data-current={current || undefined}
                  aria-current={current ? "page" : undefined}
                  className={FLYOUT_ITEM}
                  render={<Link href={item.url} onClick={navigate(item.url)} />}
                >
                  {ItemIcon && <ItemIcon />}
                  <span className="truncate">{item.title}</span>
                </MenuPrimitive.LinkItem>
              )
            })}
          </MenuPrimitive.Popup>
        </MenuPrimitive.Positioner>
      </MenuPrimitive.Portal>
    </MenuPrimitive.Root>
  )
}

/** Suzuvchi menyu — popover uslubida, ochilishi sidebar tomondan suzib chiqadi */
const FLYOUT = cn(
  "min-w-52 max-w-72 max-h-(--available-height) overflow-y-auto rounded-xl bg-popover p-1.5 text-popover-foreground",
  "shadow-lg ring-1 ring-foreground/10 outline-none origin-(--transform-origin)",
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:slide-in-from-left-1",
  "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  "duration-150 motion-reduce:animate-none",
)

/**
 * Band: hover/klaviatura — `data-highlighted`; joriy sahifa — `data-current`
 * (brend rangidagi ikonka va qalin matn, daraxtdagi faol band bilan bir xil).
 */
const FLYOUT_ITEM = cn(
  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-popover-foreground/85 outline-hidden select-none",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
  "data-highlighted:bg-accent data-highlighted:text-accent-foreground",
  "data-current:bg-sidebar-accent data-current:font-medium data-current:text-foreground data-current:[&_svg]:text-sidebar-primary",
  "transition-colors duration-150",
)

/**
 * Bo'lim ichki sahifalari daraxti. Faol qatlamlar (fon, yashil tana, shox)
 * OXIRGI faol o'rinni eslab qoladi: faol sahifa bo'limdan chiqib ketsa
 * (masalan, Monitoring bosildi), ular o'sha joyda xiralanib so'nadi.
 * Ilgari ular shu zahoti DOM'dan olinardi — panel hali 300ms yopilayotganda
 * fon va yashil yo'l bir zumda yo'qolardi (o'lchandi: 0ms da qatlam 0 ta).
 */
function SectionTree({
  items,
  activeIndex,
  navigate,
}: {
  items: NonNullable<NavSection["items"]>
  activeIndex: number
  navigate: (url: string) => (event: MouseEvent) => void
}) {
  const [lastIndex, setLastIndex] = useState(activeIndex)
  if (activeIndex >= 0 && activeIndex !== lastIndex) setLastIndex(activeIndex)

  return (
    <SidebarMenuSub
      className={TREE}
      style={{ "--active": Math.max(lastIndex, 0) } as CSSProperties}
    >
      {lastIndex >= 0 && (
        // `ul` ichida faqat `li` bo'la oladi; `contents` — o'zi joy egallamaydi,
        // qatlamlar `ul` ga nisbatan joylashadi
        <li aria-hidden className={cn("contents", activeIndex < 0 && "[&>span]:opacity-0")}>
          <span className={ACTIVE_PILL} />
          <span className={ACTIVE_TRUNK} />
          <span className={ACTIVE_ELBOW} />
        </li>
      )}
      {items.map((item, index) => {
        const ItemIcon = item.icon
        return (
          <SidebarMenuSubItem
            key={item.url}
            className={cn(BRANCH, index === activeIndex && BRANCH_UNDER_ACTIVE)}
            // Band tartibi — chizilish kechikishlari shundan
            style={{ "--i": index } as CSSProperties}
          >
            <SidebarMenuSubButton
              isActive={index === activeIndex}
              className={ITEM_BUTTON}
              render={<Link href={item.url} onClick={navigate(item.url)} />}
            >
              {ItemIcon && <ItemIcon />}
              <span>{item.title}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        )
      })}
    </SidebarMenuSub>
  )
}

/**
 * Harakat. Hammasi bitta egri chiziqda (tez boshlanib, yumshoq to'xtaydi)
 * — turli tezlikdagi animatsiyalar bir-biriga urilib, «qattiq» ko'rinadi.
 * `motion-reduce` — tizimda «harakatni kamaytirish» yoqilganlar uchun.
 */
const EASE = "ease-[cubic-bezier(0.33,1,0.68,1)]"

/** Faol bo'lim ikonkasi brend rangida — ochiq bo'limlar orasida qaysi biri
 * joriy ekani darhol ko'rinsin. Blok tugmasi faqat o'lchamni animatsiya
 * qiladi (ikonkagacha yig'ilish) — rang ham qo'shildi, aks holda hover va
 * faol fon sakrab almashadi. */
const SECTION_BUTTON = cn(
  "h-9 data-active:[&>svg:first-child]:text-sidebar-primary",
  "transition-[width,height,padding,color,background-color] duration-200",
  "[&>svg:first-child]:transition-colors [&>svg:first-child]:duration-300",
)

const CHEVRON = cn(
  "ml-auto transition-transform duration-300 group-data-open/collapsible:rotate-90",
  EASE,
  "motion-reduce:transition-none",
)

/**
 * Ochilish/yopilish — Base UI panel balandligini `--collapsible-panel-height`
 * da beradi va ochilish/yopilish chog'ida `data-starting-style` /
 * `data-ending-style` qo'yadi: o'sha paytda balandlik 0, qolgan vaqtda
 * o'lchangan qiymat → CSS o'zi silliq o'tadi. `overflow-hidden` siz
 * yopilayotgan bandlar pastdagi bo'limlar ustiga chiqib turardi.
 */
const PANEL = cn(
  "h-(--collapsible-panel-height) overflow-hidden",
  "transition-[height] duration-[360ms]",
  EASE,
  "data-starting-style:h-0 data-ending-style:h-0",
  "motion-reduce:transition-none",
)

/**
 * Ichki sahifalar — daraxt. Blokdagi tekis `border-l` o'rniga har band
 * o'zining KULRANG shoxini chizadi:
 *  - `before` — tana (band bo'yi to'liq), oxirgi bandda yo'q: tana oxirgi
 *    shox egilishida tugaydi;
 *  - `after` — shox: tepadan band o'rtasigacha tushib, yumaloq burchak
 *    bilan o'ngga buriladi.
 * Chiziqlar uzilmasin deb oraliq `gap` bilan emas, band ichidagi `py`
 * bilan beriladi. `ml-[15px]` — tana bo'lim ikonkasining o'rtasidan
 * (tugma `p-2` + 16px ikonka → 16px) tushadi.
 *
 * Har band AYNAN `ROW` (2.5rem = 2.25rem tugma + 2×0.125rem) — faol
 * qatlamlar (pastda) o'z joyini `--active × ROW` bilan hisoblaydi.
 * 🔴 ROW `rem` da, px EMAS: bandlar `h-10` (rem) bilan o'lchanadi, shrift
 *    o'lchami sozlamasi esa (`data-font-size` sm 15px / lg 17px) rem'ni
 *    o'zgartiradi. 40px qotirilganda kichik shriftda har band 37,5px bo'lib,
 *    faol fon har qatorda 2,5px pastga surilardi — 8-bandda ~17px (egasi
 *    skrinshoti, 2026-10-07: «Telegram bot» foni bandning tagida).
 */
const TREE = "relative mx-0 ml-[15px] translate-x-0 gap-0 border-l-0 px-0 py-0"

/**
 * Kulrang chiziqlarning O'Z animatsiyasi yo'q — ularni panel ochilishi
 * «chizadi»: panelning pastki cheti bandlarni tepadan pastga ochib boradi.
 * Alohida chizilish animatsiyasi sinab ko'rildi va olib tashlandi: panel
 * 100ms da 7 qatorni ochganda chiziq 2 qatorda edi — ikki xil tezlikdagi
 * harakat ustma-ust tushib, chiziqlar «chaqnab» chiqardi. `li` ham
 * qimirlamaydi, faqat matn (ITEM_BUTTON) suzib chiqadi.
 */
const BRANCH = cn(
  "h-10 py-0.5 pl-4",
  "before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-sidebar-tree last:before:hidden",
  "after:absolute after:top-0 after:left-0 after:h-1/2 after:w-3 after:rounded-bl-[10px] after:border-b after:border-l after:border-sidebar-tree",
  "after:transition-opacity after:duration-150",
)

/**
 * Faol bandning o'z kulrang shoxi — yashil shox tagida qoladi va egri
 * chiziq chetlari silliqlanganda (anti-aliasing) kulrang «soya» bo'lib
 * chiqib turardi. Yashil yetib kelgach (MOVE davomiyligi) yashiriladi;
 * band faollikdan chiqsa kechikishsiz qaytadi — shox bo'sh qolmaydi.
 */
const BRANCH_UNDER_ACTIVE = "after:opacity-0 after:delay-[420ms]"

/**
 * Faol holat — har bandda alohida EMAS, uchta umumiy qatlam:
 * fon (pill), yashil tana va yashil shox. Ular `--active` bo'yicha
 * birgalikda, bitta egri chiziqda siljiydi.
 *
 * Ilgari har band o'zini bo'yardi: eski band so'nib, yangisi yonardi
 * (70ms da ikkalasi yarim yoniq), yashil tana bo'laklari esa alohida
 * yonib-o'chardi — tepaga qaytishda yashil bir zumda yo'qolardi. Endi
 * fon bir banddan ikkinchisiga SIRPANADI, yashil tana u bilan birga
 * cho'ziladi/qisqaradi, shox esa tana uchida birga yuradi — pastga ham,
 * tepaga ham bir xil silliq.
 *
 * Tana — `top:0` dan faol band TEPASIGACHA (`--active × ROW`); undan
 * pastini faol shoxning o'zi (tik qismi) davom ettiradi. Qatlamlar
 * kulrang chiziqlardan keyin emas, oldin turadi, shuning uchun `z-10`.
 * Birinchi paydo bo'lishda (`starting:`) tana 0 dan o'sadi, fon va shox
 * xiralikdan chiqadi.
 */
/**
 * Siljish egri chizig'i — ochilishdagidan (EASE) boshqa. EASE boshida juda
 * tez: o'lchandi, masofaning 46% i birinchi 45ms da o'tardi, qolgani
 * 300ms sudralardi — ko'zga «sakrab, keyin sudralib». Bir joydan
 * ikkinchisiga ko'chishda jism ohista tezlanib, ohista to'xtashi kerak.
 */
const MOVE = cn(
  "duration-[420ms] ease-[cubic-bezier(0.45,0,0.15,1)]",
  "motion-reduce:transition-none",
)
const ACTIVE_PILL = cn(
  "pointer-events-none absolute top-0.5 right-0 left-[15px] h-9 rounded-md bg-sidebar-accent",
  "translate-y-[calc(var(--active)*2.5rem)] transition-[translate,opacity]",
  MOVE,
  "starting:opacity-0",
)
const ACTIVE_TRUNK = cn(
  "pointer-events-none absolute top-0 left-0 z-10 w-px bg-sidebar-primary",
  // +0.375rem (~6px) — shoxning tik qismiga kirib turadi. Tana balandlik bilan,
  // shox esa siljish bilan joylashadi va harakat paytida ular turlicha
  // yaxlitlanib, oralarida 1px uzilish ko'rinardi (egasi har o'tishda ko'rgan)
  "h-[calc(var(--active)*2.5rem+0.375rem)] transition-[height,opacity]",
  MOVE,
  "starting:h-0",
)
const ACTIVE_ELBOW = cn(
  "pointer-events-none absolute top-0 left-0 z-10 h-5 w-3 rounded-bl-[10px] border-b border-l border-sidebar-primary",
  "translate-y-[calc(var(--active)*2.5rem)] transition-[translate,opacity]",
  MOVE,
  // Birinchi paydo bo'lishda shox o'z joyida xiralikdan chiqsa, tana hali
  // o'sib kelayotganda u havoda uzilib osilib turardi (o'lchandi: 160ms da
  // shox 58% ko'rinib, tana 162px dan 94px da). Endi shox tepadan tana
  // uchida birga tushadi — egri chizig'i bir xil, doim ulangan.
  "starting:translate-y-0 starting:opacity-0",
)

const ITEM_BUTTON = cn(
  "relative h-9 gap-2.5 px-2.5 text-sidebar-foreground/80",
  "[&>svg]:text-sidebar-foreground/55",
  // Faol fonni umumiy `ACTIVE_PILL` beradi — tugmaning o'z foni yo'q
  "data-active:bg-transparent data-active:font-medium data-active:text-sidebar-accent-foreground data-active:[&>svg]:text-sidebar-primary",
  // Hover'da fon YO'Q (egasining talabi) — daraxtda faqat faol band fonli
  // bo'lsin. Bosiladigan joy ekani matn va ikonka yorqinlashishidan sezilsin.
  "hover:bg-transparent active:bg-transparent",
  "hover:text-sidebar-foreground hover:[&>svg]:text-sidebar-foreground/85",
  // Blokdagi ichki tugmada o'tish umuman yo'q — hover foni sakrab chiqardi
  "transition-[color,background-color] duration-200 [&>svg]:transition-colors [&>svg]:duration-300",
  // Matn panel uni ochayotgan payt bilan birga chiqadi. O'lchandi: 30ms
  // qadam + 40ms kechikishda panel 8 qatorni ochganda (180ms) 5-qatordan
  // pastida matn hali yo'q edi — bo'sh qatorlar ~150ms turib qolardi.
  // 20ms qadam, kechikishsiz — matn panel chetidan ortda qolmaydi.
  "[animation:sidebar-tree-item_220ms_cubic-bezier(0.33,1,0.68,1)_calc(var(--i)*20ms)_both]",
  "motion-reduce:animate-none motion-reduce:transition-none",
)
