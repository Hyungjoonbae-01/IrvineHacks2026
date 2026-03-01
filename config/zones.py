# Zone Configuration
# Defines zone boundaries and properties

ZONES = {
    'Z1': {'name': 'Entry Gate', 'priority': 'high'},
    'Z2': {'name': 'Concourse West', 'priority': 'medium'},
    'Z3': {'name': 'Main Arena', 'priority': 'critical'},
    'Z4': {'name': 'Concourse East', 'priority': 'medium'},
    'Z5': {'name': 'Exit North', 'priority': 'high'},
    'Z6': {'name': 'Exit South', 'priority': 'high'}
}

# Modality rules per zone
MODALITY_RULES = {
    'Z1': ['AUDIO'],
    'Z2': ['AUDIO'],
    'Z3': ['VISUAL', 'AUDIO'],
    'Z4': ['VISUAL', 'AUDIO'],
    'Z5': ['AUDIO'],
    'Z6': ['AUDIO']
}
