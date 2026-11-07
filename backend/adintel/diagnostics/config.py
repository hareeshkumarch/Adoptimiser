from dataclasses import dataclass


@dataclass(frozen=True)
class DetectorConfig:
    recent_days: int = 5
    baseline_days: int = 28
    horizon_days: int = 14
    min_baseline_points: int = 7
    saturation_frequency: float = 3.5
    engagement_decay_z: float = -2.0
    efficiency_cpa_z: float = 1.0
    material_cpa_lift: float = 0.08
    critical_cpa_lift: float = 0.3
    hook_dropoff_z: float = -2.5
    is_loss_delta: float = 0.1
    bleed_spend_lift: float = 0.1
    bleed_conversion_drop: float = -0.5
    spike_z: float = 3.5
    spike_rolling_days: int = 14
    spike_max_days: int = 3
    spike_min_entities: int = 2
    overlap_ratio_delta: float = 0.08
    overlap_min_corr: float = 0.5


DETECTOR = DetectorConfig()
