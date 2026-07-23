#include "Combat/AlpineTrainingTarget.h"

#include "Combat/AlpineTargetHealthComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Engine/DamageEvents.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "TimerManager.h"
#include "UObject/ConstructorHelpers.h"

AAlpineTrainingTarget::AAlpineTrainingTarget()
{
	PrimaryActorTick.bCanEverTick = false;
	SetCanBeDamaged(true);
	SetReplicates(true);
	SetReplicateMovement(false);

	CollisionRoot =
		CreateDefaultSubobject<UCapsuleComponent>(TEXT("CollisionRoot"));
	CollisionRoot->InitCapsuleSize(55.0f, 110.0f);
	CollisionRoot->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	CollisionRoot->SetCollisionObjectType(ECC_Pawn);
	CollisionRoot->SetCollisionResponseToAllChannels(ECR_Block);
	CollisionRoot->SetCanEverAffectNavigation(false);
	SetRootComponent(CollisionRoot);

	HealthComponent =
		CreateDefaultSubobject<UAlpineTargetHealthComponent>(
			TEXT("HealthComponent"));

	BaseMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("BaseMesh"));
	TorsoMesh =
		CreateDefaultSubobject<UStaticMeshComponent>(TEXT("TorsoMesh"));
	HeadMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HeadMesh"));
	CrossbarMesh =
		CreateDefaultSubobject<UStaticMeshComponent>(TEXT("CrossbarMesh"));
	HealthBarBackground =
		CreateDefaultSubobject<UStaticMeshComponent>(
			TEXT("HealthBarBackground"));
	HealthBarFill =
		CreateDefaultSubobject<UStaticMeshComponent>(TEXT("HealthBarFill"));

	for (UStaticMeshComponent* Part : {
			BaseMesh.Get(),
			TorsoMesh.Get(),
			HeadMesh.Get(),
			CrossbarMesh.Get(),
			HealthBarBackground.Get(),
			HealthBarFill.Get()})
	{
		Part->SetupAttachment(CollisionRoot);
		Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Part->SetGenerateOverlapEvents(false);
		Part->SetCanEverAffectNavigation(false);
	}

	HealthText =
		CreateDefaultSubobject<UTextRenderComponent>(TEXT("HealthText"));
	HealthText->SetupAttachment(CollisionRoot);
	HealthText->SetRelativeLocation(FVector(0.0f, 0.0f, 175.0f));
	HealthText->SetHorizontalAlignment(EHTA_Center);
	HealthText->SetVerticalAlignment(EVRTA_TextCenter);
	HealthText->SetWorldSize(22.0f);
	HealthText->SetTextRenderColor(FColor::Green);

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(
		TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphereAsset(
		TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CubeMesh = CubeAsset.Object;
	CylinderMesh = CylinderAsset.Object;
	SphereMesh = SphereAsset.Object;
	BaseMaterial = MaterialAsset.Object;

	ConfigureVisualPart(
		BaseMesh,
		CylinderMesh,
		FVector(0.0f, 0.0f, -95.0f),
		FRotator::ZeroRotator,
		FVector(0.72f, 0.72f, 0.14f));
	ConfigureVisualPart(
		TorsoMesh,
		CylinderMesh,
		FVector(0.0f, 0.0f, 5.0f),
		FRotator::ZeroRotator,
		FVector(0.42f, 0.42f, 0.92f));
	ConfigureVisualPart(
		HeadMesh,
		SphereMesh,
		FVector(0.0f, 0.0f, 82.0f),
		FRotator::ZeroRotator,
		FVector(0.42f));
	ConfigureVisualPart(
		CrossbarMesh,
		CubeMesh,
		FVector(0.0f, 0.0f, 32.0f),
		FRotator::ZeroRotator,
		FVector(0.16f, 1.15f, 0.13f));
	ConfigureVisualPart(
		HealthBarBackground,
		CubeMesh,
		FVector(0.0f, 0.0f, 145.0f),
		FRotator::ZeroRotator,
		FVector(0.05f, 0.9f, 0.08f));
	ConfigureVisualPart(
		HealthBarFill,
		CubeMesh,
		FVector(-4.0f, 0.0f, 145.0f),
		FRotator::ZeroRotator,
		FVector(0.055f, 0.86f, 0.055f));
}

void AAlpineTrainingTarget::BeginPlay()
{
	Super::BeginPlay();

	if (HealthComponent)
	{
		HealthComponent->OnTargetHealthChanged.AddDynamic(
			this,
			&AAlpineTrainingTarget::HandleHealthChanged);
	}

	if (TorsoMesh && BaseMaterial)
	{
		TorsoMesh->SetMaterial(0, BaseMaterial);
		TorsoMaterial = TorsoMesh->CreateAndSetMaterialInstanceDynamic(0);
	}
	if (HealthBarFill && BaseMaterial)
	{
		HealthBarFill->SetMaterial(0, BaseMaterial);
		HealthBarMaterial =
			HealthBarFill->CreateAndSetMaterialInstanceDynamic(0);
	}
	if (HealthBarBackground && BaseMaterial)
	{
		HealthBarBackground->SetMaterial(0, BaseMaterial);
		if (UMaterialInstanceDynamic* BackgroundMaterial =
				HealthBarBackground->CreateAndSetMaterialInstanceDynamic(0))
		{
			BackgroundMaterial->SetVectorParameterValue(
				TEXT("Color"),
				FLinearColor(0.025f, 0.025f, 0.03f, 1.0f));
		}
	}

	UpdateDisplay();
}

float AAlpineTrainingTarget::TakeDamage(
	float DamageAmount,
	const FDamageEvent& DamageEvent,
	AController* EventInstigator,
	AActor* DamageCauser)
{
	if (!HasAuthority() || !HealthComponent)
	{
		return 0.0f;
	}

	const float AuthorizedDamage = Super::TakeDamage(
		DamageAmount,
		DamageEvent,
		EventInstigator,
		DamageCauser);
	const float AppliedDamage =
		HealthComponent->ApplyTargetDamage(AuthorizedDamage);
	if (HealthComponent->IsDepleted())
	{
		GetWorldTimerManager().SetTimer(
			ResetTimer,
			this,
			&AAlpineTrainingTarget::ResetTarget,
			ResetDelay,
			false);
	}
	return AppliedDamage;
}

float AAlpineTrainingTarget::GetCollisionHalfHeight() const
{
	return CollisionRoot ? CollisionRoot->GetScaledCapsuleHalfHeight() : 110.0f;
}

void AAlpineTrainingTarget::HandleHealthChanged()
{
	UpdateDisplay();
}

void AAlpineTrainingTarget::ResetTarget()
{
	if (HealthComponent)
	{
		HealthComponent->ResetHealth();
	}
}

void AAlpineTrainingTarget::UpdateDisplay()
{
	if (!HealthComponent)
	{
		return;
	}

	const float HealthRatio = HealthComponent->GetHealthRatio();
	const bool bDepleted = HealthComponent->IsDepleted();
	const FLinearColor StatusColor = bDepleted
		? FLinearColor(0.4f, 0.02f, 0.02f, 1.0f)
		: FLinearColor::LerpUsingHSV(
			FLinearColor(0.8f, 0.08f, 0.02f, 1.0f),
			FLinearColor(0.05f, 0.75f, 0.1f, 1.0f),
			HealthRatio);

	if (TorsoMaterial)
	{
		TorsoMaterial->SetVectorParameterValue(
			TEXT("Color"),
			StatusColor * 0.55f);
	}
	if (HealthBarMaterial)
	{
		HealthBarMaterial->SetVectorParameterValue(
			TEXT("Color"),
			StatusColor);
	}
	if (HealthBarFill)
	{
		HealthBarFill->SetRelativeScale3D(
			FVector(0.055f, 0.86f * HealthRatio, 0.055f));
		HealthBarFill->SetRelativeLocation(
			FVector(-4.0f, -43.0f * (1.0f - HealthRatio), 145.0f));
	}
	if (HealthText)
	{
		const FString Status = bDepleted ? TEXT("RESETTING") : TEXT("READY");
		HealthText->SetText(FText::FromString(FString::Printf(
			TEXT("TRAINING TARGET  [%s]\nHP %.0f / %.0f   LAST -%.0f   HITS %d"),
			*Status,
			HealthComponent->GetHealth(),
			HealthComponent->GetMaxHealth(),
			HealthComponent->GetLastDamage(),
			HealthComponent->GetHitCount())));
		HealthText->SetTextRenderColor(StatusColor.ToFColor(true));
	}
}

void AAlpineTrainingTarget::ConfigureVisualPart(
	UStaticMeshComponent* Part,
	UStaticMesh* Mesh,
	const FVector& Location,
	const FRotator& Rotation,
	const FVector& Scale)
{
	if (!Part)
	{
		return;
	}

	Part->SetStaticMesh(Mesh);
	Part->SetRelativeLocation(Location);
	Part->SetRelativeRotation(Rotation);
	Part->SetRelativeScale3D(Scale);
	if (BaseMaterial)
	{
		Part->SetMaterial(0, BaseMaterial);
	}
}
