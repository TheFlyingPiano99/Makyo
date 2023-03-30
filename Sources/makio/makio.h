#pragma once

#include "../Component.h"
#include "../Mesh.h"
#include "../AssetFolderPathManager.h"
#include <chrono>

namespace Hogra::MakioSim {

		class MakioCanvas : public Component
		{
		public:

			void Init(ShaderProgram* canvasRender);

			void Draw(FBO& outFBO, const Texture2D& depthTexture, const Camera& camera) override;

			void UpdateGui() override;

			void OnFinishRender();

			void ToggleVisHeight() {
				visHeight = (visHeight < 2) ? visHeight + 1 : 0;
			}

			void Print() {
				isInstantPrint = true;
			}

		private:
			bool finishedRender = false;
			bool drawFullCanvas = false;
			FBO canvasFBO;
			Mesh quadrant;
			Mesh fullScreenQuad;
			glm::ivec2 quadrantCount;
			glm::ivec2 nextQuadrantToRender;
			int visHeight = 0;
			float irradianceScale = 1.0;
			bool isInstantPrint = false;
			bool wasFinished = false;
		};
}
