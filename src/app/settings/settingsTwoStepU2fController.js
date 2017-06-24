﻿angular
    .module('bit.settings')

    .controller('settingsTwoStepU2fController', function ($scope, apiService, $uibModalInstance, cryptoService,
        authService, toastr, $analytics, constants, $timeout, $window) {
        $analytics.eventTrack('settingsTwoStepU2fController', { category: 'Modal' });
        var _masterPasswordHash;
        var closed = false;

        $scope.deviceResponse = null;
        $scope.deviceListening = false;
        $scope.deviceError = false;

        $scope.auth = function (model) {
            _masterPasswordHash = cryptoService.hashPassword(model.masterPassword);

            $scope.authPromise = apiService.twoFactor.getU2f({}, {
                masterPasswordHash: _masterPasswordHash
            }).$promise.then(function (response) {
                $scope.enabled = response.Enabled;
                $scope.challenge = response.Challenge;
                $scope.authed = true;
                return $scope.readDevice();
            });
        };

        $scope.readDevice = function () {
            if (closed) {
                return;
            }

            console.log('listening for key...');

            $scope.deviceResponse = null;
            $scope.deviceError = false;
            $scope.deviceListening = true;

            $window.u2f.register($scope.challenge.AppId, [{
                version: $scope.challenge.Version,
                challenge: $scope.challenge.Challenge
            }], [], function (data) {
                $scope.deviceListening = false;
                if (data.errorCode === 5) {
                    $scope.readDevice();
                    return;
                }
                else if (data.errorCode) {
                    $scope.deviceError = true;
                    $scope.$apply();
                    console.log('error: ' + data.errorCode);
                    return;
                }

                $scope.deviceResponse = JSON.stringify(data);
                $scope.$apply();
            }, 5);
        };

        $scope.submit = function () {
            if ($scope.enabled) {
                disable();
                return;
            }

            update();
        };

        function disable() {
            if (!confirm('Are you sure you want to disable the U2F provider?')) {
                return;
            }

            $scope.submitPromise = apiService.twoFactor.disable({}, {
                masterPasswordHash: _masterPasswordHash,
                type: constants.twoFactorProvider.u2f
            }, function (response) {
                $analytics.eventTrack('Disabled Two-step U2F');
                toastr.success('U2F has been disabled.');
                $scope.enabled = response.Enabled;
                $scope.close();
            }).$promise;
        }

        function update() {
            $scope.submitPromise = apiService.twoFactor.putU2f({}, {
                deviceResponse: $scope.deviceResponse,
                masterPasswordHash: _masterPasswordHash
            }, function (response) {
                $analytics.eventTrack('Enabled Two-step U2F');
                $scope.enabled = response.Enabled;
                $scope.challenge = null;
                $scope.deviceResponse = null;
                $scope.deviceError = false;
            }).$promise;
        }

        $scope.close = function () {
            $uibModalInstance.close($scope.enabled);
        };

        $scope.$on('modal.closing', function (event) {
            closed = true;
        });
    });
