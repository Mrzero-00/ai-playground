#include "Game/AlpineGameMode.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Player/AlpinePlayerController.h"
#include "UI/AlpineHUD.h"

AAlpineGameMode::AAlpineGameMode()
{
	DefaultPawnClass = AAlpineMercenaryCharacter::StaticClass();
	PlayerControllerClass = AAlpinePlayerController::StaticClass();
	HUDClass = AAlpineHUD::StaticClass();
}
