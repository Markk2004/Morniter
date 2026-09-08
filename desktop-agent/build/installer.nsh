!macro customHeader
  ; Morniter is installed per user. The app owns only its application data folder.
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "ต้องการลบการจับคู่เครื่องและการตั้งค่า Morniter Local Agent ด้วยหรือไม่? หากเลือก No จะเก็บไว้สำหรับการติดตั้งครั้งถัดไป" IDNO keepAgentData
  RMDir /r "$APPDATA\Morniter Local Agent"
  keepAgentData:
!macroend
