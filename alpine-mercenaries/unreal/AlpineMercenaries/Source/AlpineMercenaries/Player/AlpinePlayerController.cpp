#include "Player/AlpinePlayerController.h"

#include "Camera/PlayerCameraManager.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "InputMappingContext.h"
#include "UObject/ConstructorHelpers.h"

AAlpinePlayerController::AAlpinePlayerController()
{
	static ConstructorHelpers::FObjectFinder<UInputMappingContext> DefaultInput(
		TEXT("/Game/Input/IMC_Default.IMC_Default"));
	static ConstructorHelpers::FObjectFinder<UInputMappingContext> MouseInput(
		TEXT("/Game/Input/IMC_MouseLook.IMC_MouseLook"));

	DefaultMappingContext = DefaultInput.Object;
	MouseLookMappingContext = MouseInput.Object;
}

void AAlpinePlayerController::BeginPlay()
{
	Super::BeginPlay();

	bShowMouseCursor = false;
	SetInputMode(FInputModeGameOnly());

	if (PlayerCameraManager)
	{
		PlayerCameraManager->ViewPitchMin = -70.0f;
		PlayerCameraManager->ViewPitchMax = 80.0f;
	}
}

void AAlpinePlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	if (!IsLocalPlayerController())
	{
		return;
	}

	UEnhancedInputLocalPlayerSubsystem* InputSubsystem =
		ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(GetLocalPlayer());
	if (!InputSubsystem)
	{
		return;
	}

	if (DefaultMappingContext)
	{
		InputSubsystem->RemoveMappingContext(DefaultMappingContext);
		InputSubsystem->AddMappingContext(DefaultMappingContext, 0);
	}
	if (MouseLookMappingContext)
	{
		InputSubsystem->RemoveMappingContext(MouseLookMappingContext);
		InputSubsystem->AddMappingContext(MouseLookMappingContext, 1);
	}
}
