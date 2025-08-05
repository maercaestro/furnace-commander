import qrcode

# Data to be encoded in the QR code
data = "https://www.furnace-commander.com/"

# Create QR code instance
qr = qrcode.QRCode(
    version=1,  # Controls the size of the QR code (1 to 40)
    error_correction=qrcode.constants.ERROR_CORRECT_L, # Error correction level
    box_size=10, # Size of each box (pixel) in the QR code
    border=4, # Size of the white border around the QR code
)

# Add data to the QR code
qr.add_data(data)
qr.make(fit=True)

# Create an image from the QR code instance
img = qr.make_image(fill_color="black", back_color="white")

# Save the image
img.save("my_qr_code.png")