# AI/Perception layer tests

import sys
import os
import cv2
import numpy as np

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from ai.perception.crowd_density import DensityEstimator, estimate_density, get_density_level


def test_crowd_density():
    """Test crowd density estimation"""
    # Create a test frame
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add some white blobs to simulate people
    cv2.rectangle(test_frame, (100, 100), (150, 200), (255, 255, 255), -1)
    cv2.rectangle(test_frame, (200, 150), (250, 250), (255, 255, 255), -1)
    cv2.rectangle(test_frame, (300, 100), (350, 200), (255, 255, 255), -1)
    
    # Define test zone
    zone_coords = {'x': 0, 'y': 0, 'width': 640, 'height': 480}
    
    # Test with background subtraction
    estimator = DensityEstimator(method='background_subtraction')
    density = estimator.estimate_density(test_frame, zone_coords)
    
    assert 0.0 <= density <= 1.0, "Density should be between 0 and 1"
    level = get_density_level(density)
    assert level in ['low', 'medium', 'high'], "Level should be low, medium, or high"
    
    print(f"Test passed: density = {density:.2f}, level = {level}")


def test_density_estimator_blob_count():
    """Test blob count method"""
    test_frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add multiple blobs
    for i in range(10):
        x = 50 + i * 60
        y = 100 + (i % 3) * 100
        cv2.circle(test_frame, (x, y), 20, (255, 255, 255), -1)
    
    zone_coords = {'x': 0, 'y': 0, 'width': 640, 'height': 480}
    
    estimator = DensityEstimator(method='blob_count')
    density = estimator.estimate_density(test_frame, zone_coords)
    
    assert 0.0 <= density <= 1.0
    print(f"Blob count test passed: density = {density:.2f}")


def test_motion_analysis():
    """Test motion stability analysis"""
    # TODO: Implement when motion_analysis is ready
    pass


def test_overload_detection():
    """Test overload signal aggregation"""
    # TODO: Implement when overload_detector is ready
    pass


if __name__ == '__main__':
    print("Running AI tests...")
    test_crowd_density()
    test_density_estimator_blob_count()
    print("All tests passed!")