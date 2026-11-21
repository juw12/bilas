; Bilas for Windows - per-user installer (no admin rights). build.py compiles it with:
;   iscc /DAppVersion=1.0.0 /DSourceDir=<dist\Bilas> /DOutputDir=<dist> /DIconFile=<build\bilas.ico> bilas.iss
; Installs to %LOCALAPPDATA%\Programs\Bilas, adds Bilas to the Start menu (and optionally the desktop) and lists it
; in Settings > Apps. The window keeps its data (your settings and where you were in the laundry) in %LOCALAPPDATA%\Bilas, which
; uninstalling leaves in place so a reinstall finds it again.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef SourceDir
  #define SourceDir "dist\Bilas"
#endif
#ifndef OutputDir
  #define OutputDir "dist"
#endif
#ifndef IconFile
  #define IconFile "build\bilas.ico"
#endif

[Setup]
AppId={{E81247BA-698B-569E-A6DE-E1E1C366EEFB}
AppName=Bilas
AppVersion={#AppVersion}
AppVerName=Bilas {#AppVersion}
AppPublisher=Juwen Lie
AppPublisherURL=https://juw12.github.io/bilas/
AppSupportURL=https://github.com/juw12/bilas
DefaultDirName={autopf}\Bilas
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=Bilas-Windows-Setup
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\Bilas.exe
UninstallDisplayName=Bilas
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
SetupLogging=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{userprograms}\Bilas"; Filename: "{app}\Bilas.exe"; Comment: "A quiet coin laundry"
Name: "{userdesktop}\Bilas"; Filename: "{app}\Bilas.exe"; Comment: "A quiet coin laundry"; Tasks: desktopicon

[Run]
Filename: "{app}\Bilas.exe"; Description: "{cm:LaunchProgram,Bilas}"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{app}\Bilas.exe"; Parameters: "--stop"; Flags: runhidden waituntilterminated; RunOnceId: "StopBilas"

[Code]
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ResultCode: Integer;
begin
  Result := '';
  { Updating: close an open Bilas window first so its files can be replaced. }
  if FileExists(ExpandConstant('{app}\Bilas.exe')) then
    Exec(ExpandConstant('{app}\Bilas.exe'), '--stop', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;
