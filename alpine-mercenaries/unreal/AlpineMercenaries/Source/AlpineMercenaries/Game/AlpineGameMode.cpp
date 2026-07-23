#include "Game/AlpineGameMode.h"

#include "Character/AlpineMercenaryCharacter.h"
#include "Player/AlpinePlayerController.h"

AAlpineGameMode::AAlpineGameMode()
{
	DefaultPawnClass = AAlpineMercenaryCharacter::StaticClass();
	PlayerControllerClass = AAlpinePlayerController::StaticClass();
}
