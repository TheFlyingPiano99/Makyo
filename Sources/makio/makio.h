#pragma once

#include "../Component.h"
#include "../Mesh.h"

namespace Hogra::MakioSim {

		class MakioCanvas : public Component
		{
		public:

			void Init(ShaderProgram* canvasRender);

			void Draw(FBO& outFBO, const Texture2D& depthTexture, const Camera& camera) override;

			void UpdateGui() override;

			void ToggleVisHeight() {
				visHeight = !visHeight;
			}

		private:
			bool finishedRender = false;
			bool drawFullCanvas = false;
			FBO canvasFBO;
			Mesh quadrant;
			Mesh fullScreenQuad;
			glm::ivec2 quadrantCount;
			glm::ivec2 nextQuadrantToRender;
			bool visHeight = false;
			float irradianceScale = 1.0;

		};
}
