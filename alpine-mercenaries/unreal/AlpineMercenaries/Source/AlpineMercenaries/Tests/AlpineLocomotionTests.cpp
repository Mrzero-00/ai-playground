#if WITH_DEV_AUTOMATION_TESTS

#include "Character/AlpineMercenaryCharacter.h"
#include "Character/AlpineVitalsComponent.h"
#include "Game/AlpineGameMode.h"
#include "Player/AlpinePlayerController.h"
#include "UI/AlpineHUD.h"

#include "Camera/CameraComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/SpringArmComponent.h"
#include "Misc/AutomationTest.h"

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FAlpineLocomotionConfigurationTest,
	"AlpineMercenaries.Locomotion.Configuration",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FAlpineLocomotionConfigurationTest::RunTest(const FString& Parameters)
{
	const AAlpineMercenaryCharacter* Character =
		GetDefault<AAlpineMercenaryCharacter>();
	const AAlpinePlayerController* PlayerController =
		GetDefault<AAlpinePlayerController>();
	const AAlpineGameMode* GameMode =
		GetDefault<AAlpineGameMode>();

	TestNotNull(TEXT("Character CDO"), Character);
	TestNotNull(TEXT("Vitals component"), Character->GetVitalsComponent());
	TestNotNull(TEXT("Shoulder camera boom"), Character->GetCameraBoom());
	TestNotNull(TEXT("Follow camera"), Character->GetFollowCamera());
	TestTrue(
		TEXT("Camera starts over the right shoulder"),
		Character->GetCameraBoom()->SocketOffset.Y > 0.0f);
	TestTrue(
		TEXT("Camera uses controller rotation"),
		Character->GetCameraBoom()->bUsePawnControlRotation);
	TestEqual(TEXT("Walking speed"), Character->GetWalkingSpeed(), 220.0f);
	TestEqual(TEXT("Jogging speed"), Character->GetJoggingSpeed(), 450.0f);
	TestEqual(TEXT("Sprinting speed"), Character->GetSprintingSpeed(), 650.0f);
	TestEqual(TEXT("Crouching speed"), Character->GetCrouchingSpeed(), 200.0f);
	TestTrue(
		TEXT("Crouching is enabled"),
		Character->GetCharacterMovement()->GetNavAgentPropertiesRef().bCanCrouch);
	TestNotNull(
		TEXT("Default input mapping context"),
		PlayerController->GetDefaultMappingContext());
	TestNotNull(
		TEXT("Mouse look mapping context"),
		PlayerController->GetMouseLookMappingContext());
	TestTrue(
		TEXT("Game mode uses Alpine character"),
		GameMode->DefaultPawnClass == AAlpineMercenaryCharacter::StaticClass());
	TestTrue(
		TEXT("Game mode uses Alpine player controller"),
		GameMode->PlayerControllerClass == AAlpinePlayerController::StaticClass());
	TestTrue(
		TEXT("Game mode uses Alpine HUD"),
		GameMode->HUDClass == AAlpineHUD::StaticClass());

	return true;
}

#endif
