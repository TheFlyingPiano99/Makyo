#pragma once

#include <vector>

#include <AL/al.h>
#include <AL/alc.h>
#include <glm/glm.hpp>
#include "AudioBuffer.h"

namespace Hogra {

	class AudioSource
	{
	public:

		void Init(AudioBuffer* _buffer);

		~AudioSource();

		void Play();

		void Stop();

		void SetGain(float gain);

		void SetPitch(float gain);

		void SetPosition(const glm::vec3& position);

		void SetVelocity(const glm::vec3& velocity);

		void SetLoop(bool loop);

		bool IsPlaying();

	private:
		ALuint glID;
		AudioBuffer* buffer = nullptr;
	};
}