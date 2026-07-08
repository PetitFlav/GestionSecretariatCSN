"""
print_windows.py
Imprime un PNG sur Brother QL-570 via le spooler Windows (win32print + Pillow).
Pas besoin de driver libusb — utilise le driver Brother natif Windows.

Dépendances :
  pip install pywin32 pillow

Usage :
  python print_windows.py <chemin_png> ["Brother QL-570"]
"""

import sys
import os

try:
    import win32print
    import win32ui
    from PIL import Image, ImageWin
except ImportError as e:
    print(f"ERREUR import : {e}")
    print("Installez : pip install pywin32 pillow")
    sys.exit(1)


def print_png(filepath: str, printer_name: str = "Brother QL-570") -> None:
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Fichier introuvable : {filepath}")

    # Vérifie que l'imprimante existe
    printers = [p[2] for p in win32print.EnumPrinters(
        win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
    )]
    if printer_name not in printers:
        raise RuntimeError(
            f"Imprimante '{printer_name}' introuvable.\n"
            f"Imprimantes disponibles : {printers}"
        )

    img = Image.open(filepath).convert("RGB")

    hDC = win32ui.CreateDC()
    hDC.CreatePrinterDC(printer_name)

    try:
        # Dimensions physiques de la page (pixels imprimante)
        pw = hDC.GetDeviceCaps(110)   # HORZRES
        ph = hDC.GetDeviceCaps(111)   # VERTRES

        # Redimensionne l'image pour tenir dans la page en gardant le ratio
        img_w, img_h = img.size
        ratio = min(pw / img_w, ph / img_h)
        new_w = int(img_w * ratio)
        new_h = int(img_h * ratio)

        # Centre sur la page
        x_off = (pw - new_w) // 2
        y_off = (ph - new_h) // 2

        hDC.StartDoc(os.path.basename(filepath))
        hDC.StartPage()

        dib = ImageWin.Dib(img)
        dib.draw(hDC.GetHandleOutput(), (x_off, y_off, x_off + new_w, y_off + new_h))

        hDC.EndPage()
        hDC.EndDoc()

        print(f"OK – '{os.path.basename(filepath)}' envoyé à '{printer_name}'")

    finally:
        hDC.DeleteDC()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python print_windows.py <chemin_png> [\"Nom imprimante\"]")
        sys.exit(1)

    filepath     = sys.argv[1]
    printer_name = sys.argv[2] if len(sys.argv) > 2 else "Brother QL-570"

    try:
        print_png(filepath, printer_name)
    except Exception as e:
        print(f"ERREUR: {e}", file=sys.stderr)
        sys.exit(1)
