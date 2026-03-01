# Test utilities and fixtures

import pytest

@pytest.fixture
def sample_zone():
    """Sample zone for testing"""
    return {
        'id': 'Z1',
        'density': 0.5,
        'flow_stability': 0.8,
        'stop_go': False
    }
