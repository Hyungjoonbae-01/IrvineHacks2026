"""
Hardware Controller Main
Listens for commands and controls output devices
"""

import sys
sys.path.append('..')

from controllers.hardware_listener import listen_for_commands
from audio.audio_controller import play_audio_cue

def main():
    """Main loop for hardware controller"""
    print("ClearPath Hardware Controller")
    print("Listening for commands...")
    
    # TODO: Initialize hardware connections
    # TODO: Start listening loop
    # listen_for_commands()

if __name__ == '__main__':
    main()
