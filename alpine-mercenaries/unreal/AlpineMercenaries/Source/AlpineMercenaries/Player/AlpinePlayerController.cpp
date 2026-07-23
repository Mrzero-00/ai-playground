#include "Player/AlpinePlayerController.h"

#include "Camera/PlayerCameraManager.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "GameFramework/Pawn.h"
#include "InputCoreTypes.h"
#include "InputMappingContext.h"
#include "TimerManager.h"
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

	ApplyDefaultViewRotation();
	ScheduleDefaultViewRotation();
}

void AAlpinePlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
	ApplyDefaultViewRotation();
	ScheduleDefaultViewRotation();
}

void AAlpinePlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();

	InputComponent->BindKey(
		EKeys::Home,
		IE_Pressed,
		this,
		&AAlpinePlayerController::ApplyDefaultViewRotation);

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

void AAlpinePlayerController::ApplyDefaultViewRotation()
{
	FRotator ViewRotation = GetControlRotation();
	ViewRotation.Pitch = DefaultViewPitch;
	if (const APawn* ControlledPawn = GetPawn())
	{
		ViewRotation.Yaw = ControlledPawn->GetActorRotation().Yaw;
	}
	ViewRotation.Roll = 0.0f;
	SetControlRotation(ViewRotation);
}

void AAlpinePlayerController::ScheduleDefaultViewRotation()
{
	GetWorldTimerManager().SetTimer(
		InitialViewResetTimer,
		this,
		&AAlpinePlayerController::ApplyDefaultViewRotation,
		0.2f,
		false);
}
