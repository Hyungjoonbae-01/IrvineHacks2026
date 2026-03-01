# Instruction templates per scenario

SCENARIOS = {
    'concert': {
        'name': 'Concert/Large Event',
        'instructions': {
            'WAIT': 'Stop moving. Wait {seconds} seconds.',
            'EXIT_LEFT': 'Follow the green exit on your left.',
            'EXIT_RIGHT': 'Follow the green exit on your right.',
            'DO_NOT_PROCEED': 'Do not proceed forward.'
        }
    },
    'transit': {
        'name': 'Transit Disruption',
        'instructions': {
            'WAIT': 'Please wait. Service will resume shortly.',
            'ALTERNATIVE': 'Use alternative platform {platform}.',
            'EXIT': 'Exit station via {direction}.',
            'STAY_BACK': 'Stay back from platform edge.'
        }
    },
    'evacuation': {
        'name': 'Emergency Evacuation',
        'instructions': {
            'EVACUATE': 'Evacuate now via exit {exit}.',
            'STAY_CALM': 'Stay calm. Follow directions.',
            'WAIT_CLEAR': 'Wait here until path is clear.',
            'NO_ENTRY': 'Do not enter this area.'
        }
    }
}
