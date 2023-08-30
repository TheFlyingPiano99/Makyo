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

		void MakyoCanvas::Init(ShaderProgram* canvasRender)
		{
			auto* quad = GeometryFactory::GetInstance()->GetSimpleQuad();
			canvasFBO.Init();

			auto* canvasTexture = Allocator::New<Texture2D>();
			canvasTexture->Init(GL_RGBA32F, glm::ivec2(MAKIO_RENDER_RES_X, MAKIO_RENDER_RES_Y), 0, GL_RGBA, GL_FLOAT);
			canvasFBO.LinkTexture(GL_COLOR_ATTACHMENT0, *canvasTexture);

			auto* normalTexture = Allocator::New<Texture2D>();
			normalTexture->Init(GL_RGB32F, glm::ivec2(MAKIO_RENDER_RES_X, MAKIO_RENDER_RES_Y), 1, GL_RGB, GL_FLOAT);
			canvasFBO.LinkTexture(GL_COLOR_ATTACHMENT1, *normalTexture);
			auto* quadrantMaterial = Allocator::New<Material>();
			quadrantMaterial->Init(canvasRender);
			quadrantMaterial->SetAlphaBlend(false);
			quadrantMaterial->SetName("QuadrantMaterial");
			quadrant.Init(quadrantMaterial, quad);
			quadrant.SetDepthTest(false);
			quadrant.SetName("QuadrantMesh");

			// Full screen quad mesh for combine scene with volume:
			auto* combineProgram = Allocator::New<ShaderProgram>();
			combineProgram->Init(
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("single2D.vert"),
				"",
				AssetFolderPathManager::getInstance()->getShaderFolderPath().append("makyohToScreen.frag")
			);

			auto* material = Allocator::New<Material>();
			material->Init(combineProgram);
			material->AddTexture(canvasTexture);
			material->AddTexture(normalTexture);
			material->SetAlphaBlend(true);
			material->SetBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
			fullScreenQuad.Init(material, quad);
			fullScreenQuad.SetDepthTest(false);
			fullScreenQuad.SetName("FullScreenQuadMesh");

			quadrantCount = glm::ivec2(4, 32);
			nextQuadrantToRender = glm::ivec2(0, 0);
			irradianceScale = 2.0f;

		}

		void MakyoCanvas::Draw(FBO& outFBO, const Texture2D& depthTexture, const Camera& camera)
		{
			if (!finishedRender) {

				// Draw itnernally:
				canvasFBO.Bind();
				quadrant.Bind();

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
				quadrant.getMaterial()->GetShaderProgram()->SetUniform("quadModelMatrix", quadModelMatrix);

				quadrant.Draw();

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
			fullScreenQuad.Bind();
			glm::mat4 transform = 
				glm::ortho(0.0f, (float)GlobalVariables::windowWidth, 0.0f, (float)GlobalVariables::windowHeight)
				* glm::translate(glm::vec3((float)GlobalVariables::windowWidth / 2.0f, (float)GlobalVariables::windowHeight / 2.0f, 0)) 
				* glm::scale(glm::vec3(300, 300, 1));
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("transform", transform);
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("visHeight", visHeight);
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("irradianceScale", irradianceScale);

			fullScreenQuad.Draw();


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
			fullScreenQuad.Bind();
			glm::mat4 transform = glm::mat4(1.0f);
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("transform", transform);
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("visHeight", visHeight);
			fullScreenQuad.getMaterial()->GetShaderProgram()->SetUniform("irradianceScale", irradianceScale);
			fullScreenQuad.Draw();

			static int imgCounter = 0;
			printFBO.saveToPPM(AssetFolderPathManager::getInstance()->getSavesFolderPath().append("canvas").append(std::to_string(imgCounter++)).append(".ppm"));

			/*
			auto var = dynamic_cast<UniformVariable<float>*>(
				quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("mirrorDistance")
			);
			if (nullptr != var) {
				var->Set(var->Get() - 0.1);
			}
			*/

			/*
			auto var = dynamic_cast<UniformVariable<float>*>(
				quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("inflexion")
				);
			if (nullptr != var) {
				var->Set(var->Get() + 0.025f);
				if (var->Get() > 1.0f) {
					var->Set(1.0f);
				}
			}
			*/

			/*
			auto var = dynamic_cast<UniformVariable<float>*>(
				quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("mirrorDepth")
				);
			if (nullptr != var) {
				var->Set(var->Get() - 0.0001f);
				DebugUtils::PrintMsg("Makio", std::string("Depth: ").append(std::to_string(var->Get())).c_str());
				if (var->Get() < -0.01f) {
					DebugUtils::PrintMsg("Makio", "Finished sweep.");
					var->Set(-0.01f);

				}
			}
			*/


			{
				auto var = dynamic_cast<UniformVariable<float>*>(
					quadrant.getMaterial()->GetShaderProgram()->GetUniformVariable("lineWidth")
					);
				if (nullptr != var) {
					var->Set(var->Get() + 0.0001f);
					DebugUtils::PrintMsg("Makyo", std::string("lineWidth: ").append(std::to_string(var->Get())).c_str());
					if (var->Get() > 0.1f) {
						DebugUtils::PrintMsg("Makyo", "Finished sweep.");
						var->Set(0.1f);

					}
				}
			}

			finishedRender = false;
			wasFinished = false;			
		}

	}
