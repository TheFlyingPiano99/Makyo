#include "makyoh.h"
#include <glm/glm.hpp>
#include <glm/mat4x4.hpp>
#include <glm/gtx/rotate_vector.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include "../UniformVariableImpl.h"
#include "../GlobalInclude.h"
#include "../DebugUtils.h"
#include "../AssetFolderPathManager.h"
#include "../GeometryFactory.h"

namespace Hogra::MakioSim {

#define MAKIO_RENDER_RES_X 1024
#define MAKIO_RENDER_RES_Y 1024

		void MakyoCanvas::Init(ShaderProgram* normalHeightProgram, ShaderProgram* canvasProgram, const std::string& height_map_path)
		{
			auto* quad = GeometryFactory::GetInstance()->GetSimpleQuad();	// Used for all meshes

			if (height_map_path != "") {
				// TODO read texture and approximate normal vectors
			}

			// Init normal-height rendering mesh:
			if (nullptr == normalHeightProgram) {
				throw std::exception("normalHeightProgram == nullptr");
			}

			auto* normalHeightTexture = Allocator::New<Texture2D>();
			normalHeightTexture->Init(GL_RGBA32F, glm::ivec2(MAKIO_RENDER_RES_X * 8, MAKIO_RENDER_RES_Y * 8), 0, GL_RGBA, GL_FLOAT);
			normalHeightFBO.Init();
			normalHeightFBO.LinkTexture(GL_COLOR_ATTACHMENT0, *normalHeightTexture);

			auto* normHeightMaterial = Allocator::New<Material>();
			normHeightMaterial->Init(normalHeightProgram);
			normHeightMaterial->SetAlphaBlend(false);
			normHeightMaterial->SetName("NormalHeightMaterial");
			mirrorNormalHeightQuad.Init(normHeightMaterial, quad);
			mirrorNormalHeightQuad.SetDepthTest(false);
			mirrorNormalHeightQuad.SetName("MirrorNormalHeightQuadMesh");



			// Init convolution mesh:
			auto* convolvedTexture = Allocator::New<Texture2D>();
			convolvedTexture->Init(GL_RGBA32F, glm::ivec2(MAKIO_RENDER_RES_X * 8, MAKIO_RENDER_RES_Y * 8), 0, GL_RGBA, GL_FLOAT);
			convolvedFBO.Init();
			convolvedFBO.LinkTexture(GL_COLOR_ATTACHMENT0, *convolvedTexture);

			auto* convolvedMaterial = Allocator::New<Material>();
			auto* convolutionProgram = Allocator::New<ShaderProgram>();
			convolutionProgram->Init(
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("fullScreenQuad.vert"),
				"",
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("makyohConvolution.frag")
			);
			convolvedMaterial->Init(convolutionProgram);
			convolvedMaterial->SetAlphaBlend(false);
			convolvedMaterial->SetName("ConvolutionMaterial");
			convolvedMaterial->AddTexture(normalHeightTexture);
			mirrorConvolutionQuad.Init(convolvedMaterial, quad);
			mirrorConvolutionQuad.SetDepthTest(false);
			mirrorConvolutionQuad.SetName("MirrorConvolutionQuadMesh");

			// Init canvas quadrant mesh:
			if (nullptr == canvasProgram) {
				throw std::exception("canvasProgram == nullptr");
			}

			canvasFBO.Init();

			auto* canvasTexture = Allocator::New<Texture2D>();
			canvasTexture->Init(GL_RGBA32F, glm::ivec2(MAKIO_RENDER_RES_X, MAKIO_RENDER_RES_Y), 1, GL_RGBA, GL_FLOAT);
			canvasFBO.LinkTexture(GL_COLOR_ATTACHMENT0, *canvasTexture);
			auto* quadrantMaterial = Allocator::New<Material>();
			quadrantMaterial->Init(canvasProgram);
			quadrantMaterial->SetAlphaBlend(false);
			quadrantMaterial->SetName("QuadrantMaterial");
			quadrantMaterial->AddTexture(convolvedTexture);
			canvasQuadrant.Init(quadrantMaterial, quad);
			canvasQuadrant.SetDepthTest(false);
			canvasQuadrant.SetName("QuadrantMesh");


			// Init full screen quad mesh to draw image on screen:

			auto* combineProgram = Allocator::New<ShaderProgram>();
			combineProgram->Init(
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("single2D.vert"),
				"",
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("makyohToScreen.frag")
			);

			auto* material = Allocator::New<Material>();
			material->Init(combineProgram);
			material->AddTexture(canvasTexture);
			material->SetAlphaBlend(true);
			material->SetBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
			imageToScreenQuad.Init(material, quad);
			imageToScreenQuad.SetDepthTest(false);
			imageToScreenQuad.SetName("FullScreenQuadMesh");


			// Parameters:

			quadrantCount = glm::ivec2(32, 32);
			nextQuadrantToRender = glm::ivec2(0, 0);
			irradianceScale = 2.0f;
		}


		void MakyoCanvas::Draw(FBO& outFBO, const Texture2D& depthTexture, const Camera& camera)
		{
			if (isRawRender) {
				isRawRender = false;
				normalHeightFBO.Bind();
				mirrorNormalHeightQuad.Bind();
				mirrorNormalHeightQuad.Draw();
				isConvolutionRender = true;
			}
			else if (isConvolutionRender) {
				isConvolutionRender = false;
				convolvedFBO.Bind();
				mirrorConvolutionQuad.Bind();
				mirrorConvolutionQuad.Draw();
			}
			else if (!finishedRender) {

				// Draw itnernally:
				canvasFBO.Bind();
				canvasQuadrant.Bind();

				if (nextQuadrantToRender.x == 0 && nextQuadrantToRender.y == 0) {	// Clear
					glClearColor(0, 0, 0, 0);
					glClear(GL_COLOR_BUFFER_BIT);
				}

				glm::mat4 quadModelMatrix;
				if (drawFullCanvas) {
					quadModelMatrix = glm::mat4(1.0f);
				}
				else {
					quadModelMatrix =
						glm::translate(
							glm::vec3(2.0f / (float)quadrantCount.x, 2.0f / (float)quadrantCount.y, 0.0f) * glm::vec3(nextQuadrantToRender.x, nextQuadrantToRender.y, 0.0f)
							- glm::vec3(1.0f - 1.0f / (float)quadrantCount.x, 1.0f - 1.0f / (float)quadrantCount.y, 0.0f))
						* glm::scale(glm::vec3(1.0f / (float)quadrantCount.x, 1.0f / (float)quadrantCount.y, 1.0f));
				}
				canvasQuadrant.getMaterial()->GetShaderProgram()->SetUniform("quadModelMatrix", quadModelMatrix);

				canvasQuadrant.Draw();

				if (nextQuadrantToRender.x < quadrantCount.x - 1) {
					nextQuadrantToRender.x++;
				}
				else {
					nextQuadrantToRender.x = 0;
					if (nextQuadrantToRender.y < quadrantCount.y - 1) {
						nextQuadrantToRender.y++;
					}
					else {
						nextQuadrantToRender.y = 0;
						finishedRender = true;
					}
				}
			}

			// Draw on screen:
			outFBO.Bind();
			imageToScreenQuad.Bind();
			glm::mat4 transform = 
				glm::ortho(0.0f, (float)GlobalVariables::windowWidth, 0.0f, (float)GlobalVariables::windowHeight)
				* glm::translate(glm::vec3((float)GlobalVariables::windowWidth / 2.0f, (float)GlobalVariables::windowHeight / 2.0f, 0)) 
				* glm::scale(glm::vec3(300, 300, 1));
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("transform", transform);
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("visHeight", visHeight);
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("irradianceScale", irradianceScale);

			imageToScreenQuad.Draw();


			if (finishedRender && !wasFinished) {
				wasFinished = true;
				OnFinishRender();
			}

			outFBO.Unbind();
		}

		void MakyoCanvas::UpdateGui()
		{
			/*
			ImGui::Begin("Makyo settings");
			{
				ImGui::SliderFloat("Irradiance scale", &irradianceScale, 0.0f, 10.0f);
			}
			ImGui::End();
			*/
		}

		void MakyoCanvas::OnFinishRender()
		{
			// Draw on screen:
			FBO printFBO;
			printFBO.Init();
			Texture2D outTexture;
			outTexture.Init(GL_RGB8, glm::ivec2(MAKIO_RENDER_RES_X, MAKIO_RENDER_RES_Y), 0, GL_RGB, GL_BYTE);
			printFBO.LinkTexture(GL_COLOR_ATTACHMENT0, outTexture);
			printFBO.Bind();
			imageToScreenQuad.Bind();
			glm::mat4 transform = glm::mat4(1.0f);
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("transform", transform);
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("visHeight", visHeight);
			imageToScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("irradianceScale", irradianceScale);
			imageToScreenQuad.Draw();

			printFBO.saveToPPM(AssetFolderPathManager::getInstance()->getSavesFolderPath().append("canvas_")
				.append(std::to_string(finishedRenderCount)).append(".ppm"));

			static float focalDepth = 0.0f;
			static float shininess = 0.0f;
			int res = 0;



			auto uniMirrorDistance = dynamic_cast<UniformVariable<float>*>(
				canvasQuadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("wMirrorDistance")
				);
			auto uniShininess = dynamic_cast<UniformVariable<float>*>(
				canvasQuadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("mirrorShininess")
				);
			auto uniResolution = 
				dynamic_cast<UniformVariable<int>*>(
					canvasQuadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("mirrorSampleCountPerPixel")
			);


			/*
			printFBO.saveToPPM(AssetFolderPathManager::getInstance()->getSavesFolderPath().append("canvas")
				.append((0 == imgCounter) ? "_focused" : ((1 == imgCounter) ? "_half_of_focal_depth" : "_double_of_focal_depth")).append(".ppm"));
			if (0 == imgCounter) {
				focalDepth = dynamic_cast<UniformVariable<float>*>(
					quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("wCarvRadius"))->Get() / 2.0f;
				shininess = dynamic_cast<UniformVariable<float>*>(
					quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("mirrorShininess"))->Get();
				//res = uniShininess->Get();
				uniMirrorDistance->Set(focalDepth / 2.0f);
				uniShininess->Set(shininess / 1.4f );
				//uniResolution->Set(res * 3 / 2);
			}
			else if (1 == imgCounter) {
				uniMirrorDistance->Set(focalDepth * 2.0f);
				uniShininess->Set(shininess * 1.4f);
				//uniResolution->Set(res);
			}
			else {
				return;
			}
			*/

			/*
			auto uniMirrorDistance = dynamic_cast<UniformVariable<float>*>(
				quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("wMirrorDistance")
			);
			*/

			/*
			uniMirrorDistance->Set(uniMirrorDistance->Get() + 0.5f);
			printFBO.saveToPPM(AssetFolderPathManager::getInstance()->getSavesFolderPath().append("canvas")
				.append(std::to_string(imgCounter)).append(".ppm"));
			*/


			finishedRender = false;
			wasFinished = false;			
			finishedRenderCount++;
		}

	}
