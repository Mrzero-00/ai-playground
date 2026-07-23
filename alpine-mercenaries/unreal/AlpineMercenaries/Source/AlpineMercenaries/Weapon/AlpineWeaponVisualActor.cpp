#include "Weapon/AlpineWeaponVisualActor.h"

#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "UObject/ConstructorHelpers.h"

AAlpineWeaponVisualActor::AAlpineWeaponVisualActor()
{
	PrimaryActorTick.bCanEverTick = false;
	SetReplicates(false);
	SetCanBeDamaged(false);

	VisualRoot = CreateDefaultSubobject<USceneComponent>(TEXT("VisualRoot"));
	SetRootComponent(VisualRoot);

	PartA = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PartA"));
	PartB = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PartB"));
	PartC = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PartC"));
	PartD = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("PartD"));
	for (UStaticMeshComponent* Part : {PartA.Get(), PartB.Get(), PartC.Get(), PartD.Get()})
	{
		Part->SetupAttachment(VisualRoot);
		Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		Part->SetGenerateOverlapEvents(false);
	}

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeAsset(
		TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylinderAsset(
		TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MaterialAsset(
		TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	CubeMesh = CubeAsset.Object;
	CylinderMesh = CylinderAsset.Object;
	BaseMaterial = MaterialAsset.Object;
}

void AAlpineWeaponVisualActor::ConfigureForWeapon(
	EAlpineWeaponType WeaponType,
	bool bOffhand)
{
	ResetParts();

	const FLinearColor Steel(0.3f, 0.36f, 0.42f, 1.0f);
	const FLinearColor DarkSteel(0.08f, 0.1f, 0.13f, 1.0f);
	const FLinearColor Leather(0.22f, 0.09f, 0.035f, 1.0f);
	const FLinearColor Wood(0.3f, 0.12f, 0.045f, 1.0f);

	if (WeaponType == EAlpineWeaponType::SwordAndShield && bOffhand)
	{
		ConfigurePart(
			PartA,
			CylinderMesh,
			FVector::ZeroVector,
			FRotator(90.0f, 0.0f, 0.0f),
			FVector(0.42f, 0.42f, 0.08f),
			DarkSteel);
		ConfigurePart(
			PartB,
			CylinderMesh,
			FVector(0.0f, -5.0f, 0.0f),
			FRotator(90.0f, 0.0f, 0.0f),
			FVector(0.12f, 0.12f, 0.12f),
			Steel);
		SetActorRelativeLocation(FVector(4.0f, 0.0f, 2.0f));
		SetActorRelativeRotation(FRotator(0.0f, 90.0f, 0.0f));
		return;
	}

	switch (WeaponType)
	{
	case EAlpineWeaponType::Bow:
		ConfigurePart(
			PartA,
			CylinderMesh,
			FVector::ZeroVector,
			FRotator::ZeroRotator,
			FVector(0.045f, 0.045f, 0.24f),
			Leather);
		ConfigurePart(
			PartB,
			CubeMesh,
			FVector(0.0f, 0.0f, 44.0f),
			FRotator(0.0f, -18.0f, 0.0f),
			FVector(0.035f, 0.025f, 0.48f),
			Wood);
		ConfigurePart(
			PartC,
			CubeMesh,
			FVector(0.0f, 0.0f, -44.0f),
			FRotator(0.0f, 18.0f, 0.0f),
			FVector(0.035f, 0.025f, 0.48f),
			Wood);
		ConfigurePart(
			PartD,
			CubeMesh,
			FVector(8.0f, 0.0f, 0.0f),
			FRotator::ZeroRotator,
			FVector(0.01f, 0.01f, 0.9f),
			Steel);
		SetActorRelativeLocation(FVector(2.0f, 0.0f, 0.0f));
		SetActorRelativeRotation(FRotator(0.0f, 0.0f, 90.0f));
		break;
	case EAlpineWeaponType::Greatsword:
		ConfigurePart(
			PartA,
			CubeMesh,
			FVector(0.0f, 0.0f, 82.0f),
			FRotator::ZeroRotator,
			FVector(0.11f, 0.035f, 0.82f),
			DarkSteel);
		ConfigurePart(
			PartB,
			CubeMesh,
			FVector(0.0f, 0.0f, 28.0f),
			FRotator::ZeroRotator,
			FVector(0.18f, 0.055f, 0.16f),
			Steel);
		ConfigurePart(
			PartC,
			CubeMesh,
			FVector(0.0f, 0.0f, 5.0f),
			FRotator::ZeroRotator,
			FVector(0.34f, 0.055f, 0.035f),
			Steel);
		ConfigurePart(
			PartD,
			CylinderMesh,
			FVector(0.0f, 0.0f, -18.0f),
			FRotator::ZeroRotator,
			FVector(0.055f, 0.055f, 0.28f),
			Leather);
		SetActorRelativeLocation(FVector(0.0f, 0.0f, 4.0f));
		SetActorRelativeRotation(FRotator(0.0f, 0.0f, 0.0f));
		break;
	case EAlpineWeaponType::SwordAndShield:
	default:
		ConfigurePart(
			PartA,
			CubeMesh,
			FVector(0.0f, 0.0f, 54.0f),
			FRotator::ZeroRotator,
			FVector(0.055f, 0.022f, 0.52f),
			Steel);
		ConfigurePart(
			PartB,
			CubeMesh,
			FVector(0.0f, 0.0f, 5.0f),
			FRotator::ZeroRotator,
			FVector(0.23f, 0.045f, 0.035f),
			DarkSteel);
		ConfigurePart(
			PartC,
			CylinderMesh,
			FVector(0.0f, 0.0f, -14.0f),
			FRotator::ZeroRotator,
			FVector(0.045f, 0.045f, 0.24f),
			Leather);
		SetActorRelativeLocation(FVector(0.0f, 0.0f, 4.0f));
		SetActorRelativeRotation(FRotator::ZeroRotator);
		break;
	}
}

void AAlpineWeaponVisualActor::ResetParts()
{
	for (UStaticMeshComponent* Part : {PartA.Get(), PartB.Get(), PartC.Get(), PartD.Get()})
	{
		Part->SetStaticMesh(nullptr);
		Part->SetVisibility(false, true);
		Part->SetRelativeTransform(FTransform::Identity);
	}
	SetActorRelativeTransform(FTransform::Identity);
}

void AAlpineWeaponVisualActor::ConfigurePart(
	UStaticMeshComponent* Part,
	UStaticMesh* Mesh,
	const FVector& Location,
	const FRotator& Rotation,
	const FVector& Scale,
	const FLinearColor& Color)
{
	if (!Part || !Mesh)
	{
		return;
	}

	Part->SetStaticMesh(Mesh);
	Part->SetRelativeLocation(Location);
	Part->SetRelativeRotation(Rotation);
	Part->SetRelativeScale3D(Scale);
	Part->SetVisibility(true, true);
	if (BaseMaterial)
	{
		UMaterialInstanceDynamic* Material =
			UMaterialInstanceDynamic::Create(BaseMaterial, this);
		Material->SetVectorParameterValue(TEXT("Color"), Color);
		Part->SetMaterial(0, Material);
	}
}
