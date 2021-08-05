import pyautogui, time, keyboard

time.sleep(30)

for i in range(10000):
    pyautogui.press('down')
    
    pyautogui.press('space')
    print(i)

    if keyboard.is_pressed('q'):
        print('Finish')
        break
