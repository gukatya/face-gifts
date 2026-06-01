"""Excel export — сводный список позиций для отгрузки со склада."""
import io
from collections import defaultdict
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from ..models import Event, GiftSet

BRAND      = "2E4057"
BRAND_PALE = "EEF3FB"

def _side(style="thin", color="CCCCCC"):
    return Side(style=style, color=color)

def _border(color="CCCCCC"):
    s = _side(color=color)
    return Border(left=s, right=s, top=s, bottom=s)

BORDER_THIN  = _border()
BORDER_BRAND = _border(BRAND)

def _f(bold=False, size=10, color="000000"):
    return Font(name="Arial", size=size, bold=bold, color=color)

def _c(ws, row, col, value="", bold=False, size=10, color="000000",
       bg=None, align="left", border=True, num_fmt=None):
    c = ws.cell(row=row, column=col, value=value)
    c.font = _f(bold=bold, size=size, color=color)
    c.alignment = Alignment(horizontal=align, vertical="center")
    if bg:
        c.fill = PatternFill("solid", fgColor=bg)
    if border:
        c.border = BORDER_THIN
    if num_fmt:
        c.number_format = num_fmt
    return c


_TYPE_ORDER = {"sample": 0, "pigment": 1, "consumable": 2, "certificate": 3}


def _get_set_count(gs: GiftSet, event: Event) -> int:
    if gs.place == "участник":
        return max(event.participants_count or 1, 1)
    if gs.place == "гран-при":
        return 1
    if gs.place == "розыгрыш":
        gm = getattr(event, "giveaway_mode", None) or "одинаковые"
        return 1 if gm == "разные" else max(event.giveaways_count or 1, 1)
    noms = event.nominations_data or []
    key = {"1": "place1", "2": "place2", "3": "place3"}.get(gs.place, "place1")
    for n in noms:
        if n.get("name") == gs.nomination_name:
            return max(n.get(key, 1), 1)
    return 1


def export_event_to_excel(event: Event, sets: list[GiftSet]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Список отгрузки"

    # Ширины колонок: # | Наименование | Линия | Цена | Кол-во | Итого
    for col, w in zip("ABCDEF", [4, 44, 20, 14, 12, 16]):
        ws.column_dimensions[col].width = w

    row = 1

    # ── Шапка мероприятия ────────────────────────────────────────────────
    ws.merge_cells(f"A{row}:F{row}")
    t = ws.cell(row=row, column=1, value="FACE Pigments — список отгрузки")
    t.font = _f(bold=True, size=14, color="FFFFFF")
    t.fill = PatternFill("solid", fgColor=BRAND)
    t.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row].height = 30
    row += 1

    ws.merge_cells(f"A{row}:F{row}")
    n = ws.cell(row=row, column=1, value=event.name or "")
    n.font = _f(bold=True, size=12, color=BRAND)
    n.fill = PatternFill("solid", fgColor=BRAND_PALE)
    n.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[row].height = 24
    row += 1

    def meta(label, value):
        nonlocal row
        ws.cell(row=row, column=1, value=label).font = _f(bold=True, size=10, color=BRAND)
        ws.merge_cells(start_row=row, start_column=2, end_row=row, end_column=6)
        ws.cell(row=row, column=2, value=value).font = _f(size=10)
        ws.row_dimensions[row].height = 17
        row += 1

    loc = event.country or ""
    if event.region and event.region != event.country:
        loc += f" / {event.region}"
    meta("Страна / регион:", loc)
    meta("Дата:", str(event.date or ""))
    meta("Склад:", event.warehouse or "")

    extras = []
    if getattr(event, "has_trade_booth", False):     extras.append("торговая точка")
    if getattr(event, "has_speaker_nonstop", False): extras.append("спикер нонстоп")
    if getattr(event, "has_speaker_stage", False):   extras.append("спикер на сцене")
    meta("Доп. условия:", ", ".join(extras) if extras else "—")

    row += 1  # отступ

    # ── Агрегация позиций ─────────────────────────────────────────────────
    # Ключ: (sku_type, sku_id, name, line) → {qty, price}
    agg: dict = defaultdict(lambda: {"qty": 0, "price": 0})

    for gs in sets:
        count = _get_set_count(gs, event)
        for item in gs.items or []:
            key = (
                item.get("sku_type", "consumable"),
                item.get("sku_id", 0),
                item.get("name", ""),
                item.get("line") or "",
            )
            agg[key]["qty"]   += item.get("qty", 1) * count
            agg[key]["price"]  = item.get("price", 0)  # цена единицы одинакова везде

    # Сортировка: сэмплы → пигменты (по линии, затем имени) → расходники → сертификаты
    def sort_key(entry):
        (sku_type, _, name, line) = entry[0]
        return (_TYPE_ORDER.get(sku_type, 9), line.lower(), name.lower())

    sorted_items = sorted(agg.items(), key=sort_key)

    # ── Заголовки таблицы ─────────────────────────────────────────────────
    col_labels = ["#", "Наименование", "Линия / категория", "Розн. цена", "Кол-во", "Итого"]
    col_aligns = ["center", "left", "left", "right", "center", "right"]
    for ci, (lbl, al) in enumerate(zip(col_labels, col_aligns), 1):
        c = ws.cell(row=row, column=ci, value=lbl)
        c.font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor=BRAND)
        c.alignment = Alignment(horizontal=al, vertical="center")
        c.border = BORDER_THIN
    ws.row_dimensions[row].height = 20
    row += 1

    # ── Строки данных ─────────────────────────────────────────────────────
    STRIPE = "F5F8FC"
    grand_total = 0

    for idx, ((sku_type, sku_id, name, line), data) in enumerate(sorted_items, 1):
        qty   = data["qty"]
        price = data["price"]
        total = price * qty
        grand_total += total

        bg = STRIPE if idx % 2 == 0 else None

        _c(ws, row, 1, idx,   align="center", bg=bg)
        _c(ws, row, 2, name,  align="left",   bg=bg)
        _c(ws, row, 3, line,  align="left",   bg=bg, color="666666")
        _c(ws, row, 4, price, align="right",  bg=bg, num_fmt='#,##0 "₽"')
        _c(ws, row, 5, qty,   align="center", bg=bg)
        _c(ws, row, 6, total, align="right",  bg=bg, bold=True, num_fmt='#,##0 "₽"')
        ws.row_dimensions[row].height = 17
        row += 1

    # ── Итого ─────────────────────────────────────────────────────────────
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=5)
    gl = ws.cell(row=row, column=1, value="ИТОГО К ОТГРУЗКЕ:")
    gl.font = _f(bold=True, size=12, color="FFFFFF")
    gl.fill = PatternFill("solid", fgColor=BRAND)
    gl.alignment = Alignment(horizontal="right", vertical="center")
    gl.border = BORDER_BRAND

    gv = ws.cell(row=row, column=6, value=grand_total)
    gv.font = _f(bold=True, size=12, color="FFFFFF")
    gv.fill = PatternFill("solid", fgColor=BRAND)
    gv.alignment = Alignment(horizontal="right", vertical="center")
    gv.number_format = '#,##0 "₽"'
    gv.border = BORDER_BRAND
    ws.row_dimensions[row].height = 28

    # Закрепить строку с заголовками таблицы
    ws.freeze_panes = f"A{row - len(sorted_items)}"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
