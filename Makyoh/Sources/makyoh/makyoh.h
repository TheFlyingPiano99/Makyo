#pragma once

#include "../Component.h"
#include "../Mesh.h"
#include "../AssetFolderPathManager.h"
#include <chrono>

namespace Hogra::MakioSim {

		class MakyoCanvas : public Component
		{
		public:

			void Init(ShaderProgram* normalHeightProgram, ShaderProgram* canvasProgram, const std::string& height_map_path = "");

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
			bool isRawRender = true;
			bool isConvolutionRender = false;
			bool finishedRender = false;
			bool drawFullCanvas = false;
			FBO normalHeightFBO;
			FBO canvasFBO;
			FBO convolvedFBO;
			Mesh mirrorNormalHeightQuad;	// To render the normal and height information of the mirror
			Mesh mirrorConvolutionQuad;		// To perform convolution filtering
			Mesh canvasQuadrant;			// To render the canvas irradiance image in quadrants
			Mesh imageToScreenQuad;			// To render the image on screen
			glm::ivec2 quadrantCount;
			glm::ivec2 nextQuadrantToRender;
			int visHeight = 0;
			float irradianceScale = 1.0;
			bool isInstantPrint = false;
			bool wasFinished = false;
			int finishedRenderCount = 0;
		};
}
